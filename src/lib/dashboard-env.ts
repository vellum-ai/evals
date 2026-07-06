/**
 * Shared *mechanics* for reading the QA-dashboard launcher env vars
 * (`EVAL_RESULTS_UPLOAD_URL`, `QA_AUTH_TOKEN`): values are trimmed and
 * whitespace-only collapses to `undefined`.
 *
 * *Policy* — which combinations activate what — deliberately stays with
 * each caller:
 *   - `resolveRunEventsConfig` (run-events.ts): both-or-nothing; live
 *     events are disabled unless URL and token are both present.
 *   - `autoPublishSession` (auto-publish.ts): the URL alone activates
 *     publishing; a missing token warns loudly and skips.
 *   - `pushBundleToUrl` (bundle-push.ts): the env token is only a
 *     fallback for direct `evals export --out <url>` use; missing throws.
 */

interface DashboardEnv {
  /** Trimmed `EVAL_RESULTS_UPLOAD_URL`; `undefined` when unset/blank. */
  baseUrl?: string;
  /** Trimmed `QA_AUTH_TOKEN`; `undefined` when unset/blank. */
  authToken?: string;
}

export function readDashboardEnv(
  env: NodeJS.ProcessEnv = process.env,
): DashboardEnv {
  const baseUrl = env.EVAL_RESULTS_UPLOAD_URL?.trim();
  const authToken = env.QA_AUTH_TOKEN?.trim();
  return {
    baseUrl: baseUrl || undefined,
    authToken: authToken || undefined,
  };
}

/**
 * Normalize a dashboard base URL for path joining: strip trailing
 * slashes so `<base>/api/...` never produces `//`.
 */
export function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}
