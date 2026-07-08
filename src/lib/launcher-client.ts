/**
 * Client for the eval-launcher HTTP seam on qa.vellum.ai.
 *
 * When `evals run --launcher` is set, the CLI delegates execution to the
 * platform's dedicated eval environment instead of running locally. This
 * module posts the run request to the qa dashboard's trigger API
 * (`POST /api/evals/trigger`) and polls the status endpoint
 * (`GET /api/evals/status/{runId}`) until the run reaches a terminal state.
 *
 * The trigger/status routes on qa.vellum.ai proxy to the internal
 * eval-launcher FastAPI service (VPC-internal L4 LB). See
 * `eval-launcher/docs/http-contract.md` in the platform repo for the
 * frozen contract.
 *
 * Env vars (shared with the live-events and auto-publish paths):
 *   - `EVAL_RESULTS_UPLOAD_URL` — base URL of the qa dashboard
 *     (defaults to `https://qa.vellum.ai`).
 *   - `QA_AUTH_TOKEN` — bearer token for the qa dashboard API.
 */

import { readDashboardEnv, stripTrailingSlashes } from "./dashboard-env";

/** Default qa dashboard URL when the env var is not set. */
const DEFAULT_DASHBOARD_URL = "https://qa.vellum.ai";

/** Polling interval for run status (seconds → ms). */
const POLL_INTERVAL_MS = 5_000;

/** Maximum time to poll before giving up (10 minutes). */
const POLL_TIMEOUT_MS = 10 * 60 * 1_000;

export type RunStatusValue = "pending" | "running" | "succeeded" | "failed";

/** Response from `POST /api/evals/trigger` (201). */
interface TriggerResponse {
  runId: string;
  status: string;
}

/** Response from `GET /api/evals/status/{runId}` (200). */
export interface RunStatusResponse {
  runId: string;
  jobName: string;
  status: RunStatusValue;
  startedAt: string | null;
  finishedAt: string | null;
  podPhase: string | null;
  logsRef: string;
  resultsRef: string;
}

/** Input for submitting a run via the launcher. */
export interface LauncherSubmitInput {
  profiles: string[];
  benchmark: string;
  filter?: string | null;
  imageTag?: string | null;
}

/** Result of a launcher submission. */
export interface LauncherSubmitResult {
  ok: true;
  runId: string;
  status: string;
}

/** Error from a launcher submission. */
export interface LauncherSubmitError {
  ok: false;
  status: number;
  message: string;
  runId?: string;
}

function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const { baseUrl } = readDashboardEnv(env);
  return stripTrailingSlashes(baseUrl ?? DEFAULT_DASHBOARD_URL);
}

function resolveAuthToken(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const { authToken } = readDashboardEnv(env);
  return authToken;
}

/**
 * Submit a run to the eval launcher via the qa dashboard trigger API.
 * Returns a discriminated union: `{ ok: true, runId, status }` on 201,
 * or `{ ok: false, status, message, runId? }` on any error.
 */
export async function submitToLauncher(
  input: LauncherSubmitInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<LauncherSubmitResult | LauncherSubmitError> {
  const baseUrl = resolveBaseUrl(env);
  const authToken = resolveAuthToken(env);

  if (!authToken) {
    return {
      ok: false,
      status: 0,
      message:
        "QA_AUTH_TOKEN is not set — set it (or export EVAL_RESULTS_UPLOAD_URL + QA_AUTH_TOKEN) to use --launcher.",
    };
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/evals/trigger`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: `Failed to reach ${baseUrl}/api/evals/trigger: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (res.ok) {
    const data = body as TriggerResponse;
    return { ok: true, runId: data.runId, status: data.status };
  }

  const errorBody = body as {
    error?: string;
    runId?: string;
    detail?: unknown;
  } | null;
  const message =
    errorBody?.error ??
    (typeof errorBody?.detail === "string"
      ? errorBody.detail
      : `HTTP ${res.status}`) ??
    text;

  return {
    ok: false,
    status: res.status,
    message: typeof message === "string" ? message : `HTTP ${res.status}`,
    runId: errorBody?.runId,
  };
}

/**
 * Poll the launcher status endpoint until the run reaches a terminal
 * state (`succeeded` or `failed`) or the timeout elapses.
 *
 * Calls `onStatus` with each status update so the caller can print
 * progress to the console.
 */
export async function pollLauncherStatus(
  runId: string,
  opts: {
    onStatus?: (status: RunStatusResponse) => void;
    intervalMs?: number;
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<RunStatusResponse | undefined> {
  const baseUrl = resolveBaseUrl(opts.env);
  const authToken = resolveAuthToken(opts.env);
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? POLL_TIMEOUT_MS;

  if (!authToken) return undefined;

  const deadline = Date.now() + timeoutMs;
  let lastStatus: RunStatusResponse | undefined;

  while (Date.now() < deadline) {
    let res: Response;
    try {
      res = await fetch(
        `${baseUrl}/api/evals/status/${encodeURIComponent(runId)}`,
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
    } catch {
      // Network hiccup — wait and retry.
      await sleep(intervalMs);
      continue;
    }

    if (res.ok) {
      const status = (await res
        .json()
        .catch(() => null)) as RunStatusResponse | null;
      if (status) {
        lastStatus = status;
        opts.onStatus?.(status);
        if (status.status === "succeeded" || status.status === "failed") {
          return status;
        }
      }
    }

    await sleep(intervalMs);
  }

  return lastStatus;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default qa dashboard URL for display purposes (e.g. printing the
 * results link before polling starts).
 */
export function dashboardBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return resolveBaseUrl(env);
}
