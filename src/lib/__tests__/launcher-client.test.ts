import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import {
  submitToLauncher,
  pollLauncherStatus,
  dashboardBaseUrl,
} from "../launcher-client";

/**
 * Minimal fetch mock: returns a queued response (or a default 200 JSON).
 * Each test scopes its own mock + env so there's no cross-test bleed.
 */
function mockFetch(
  responses: Array<{ status: number; body: unknown }>,
): ReturnType<typeof mock> {
  let callIdx = 0;
  const calls: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }> = [];
  const fn = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = init.headers as Record<string, string>;
      for (const [k, v] of Object.entries(h)) headers[k] = v;
    }
    calls.push({
      url,
      method,
      headers,
      body: init?.body as string | undefined,
    });

    const resp = responses[Math.min(callIdx, responses.length - 1)];
    callIdx++;
    return new Response(JSON.stringify(resp?.body ?? {}), {
      status: resp?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
  return fn;
}

const TEST_ENV = {
  EVAL_RESULTS_UPLOAD_URL: "https://qa.test.example",
  QA_AUTH_TOKEN: "test-token",
};

describe("launcher-client", () => {
  let origFetch: typeof globalThis.fetch;
  let origEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origEnv = { ...process.env };
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env = origEnv;
  });

  describe("submitToLauncher", () => {
    test("posts to /api/evals/trigger with bearer auth and returns runId on 201", async () => {
      const fn = mockFetch([
        { status: 201, body: { runId: "eval-run-abc", status: "pending" } },
      ]);

      const result = await submitToLauncher(
        { profiles: ["vellum-default"], benchmark: "longmemeval-v2" },
        TEST_ENV,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runId).toBe("eval-run-abc");
        expect(result.status).toBe("pending");
      }

      expect(fn).toHaveBeenCalledTimes(1);
      const call = (fn as unknown as { mock: { calls: unknown[][] } }).mock
        .calls[0];
      const [url, init] = call as [string, RequestInit];
      expect(url).toBe("https://qa.test.example/api/evals/trigger");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      });
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        profiles: ["vellum-default"],
        benchmark: "longmemeval-v2",
      });
    });

    test("includes filter and imageTag when provided", async () => {
      mockFetch([{ status: 201, body: { runId: "r1", status: "pending" } }]);

      await submitToLauncher(
        {
          profiles: ["a", "b"],
          benchmark: "swe-bench",
          filter: "test-1,test-2",
          imageTag: "v1.2.3",
        },
        TEST_ENV,
      );

      const calls = (
        globalThis.fetch as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls;
      const body = JSON.parse((calls[0][1] as RequestInit).body as string);
      expect(body.profiles).toEqual(["a", "b"]);
      expect(body.filter).toBe("test-1,test-2");
      expect(body.imageTag).toBe("v1.2.3");
    });

    test("returns error when QA_AUTH_TOKEN is missing", async () => {
      const result = await submitToLauncher(
        { profiles: ["a"], benchmark: "b" },
        { EVAL_RESULTS_UPLOAD_URL: "https://qa.test.example" },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(0);
        expect(result.message).toContain("QA_AUTH_TOKEN");
      }
    });

    test("returns error with runId on 409 conflict", async () => {
      mockFetch([
        {
          status: 409,
          body: {
            error: "A run with these exact inputs already exists",
            runId: "existing-run",
          },
        },
      ]);

      const result = await submitToLauncher(
        { profiles: ["a"], benchmark: "b" },
        TEST_ENV,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(409);
        expect(result.runId).toBe("existing-run");
      }
    });

    test("returns error on 429 quota", async () => {
      mockFetch([{ status: 429, body: { error: "At capacity" } }]);

      const result = await submitToLauncher(
        { profiles: ["a"], benchmark: "b" },
        TEST_ENV,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(429);
        expect(result.message).toContain("At capacity");
      }
    });

    test("defaults to https://qa.vellum.ai when EVAL_RESULTS_UPLOAD_URL is unset", async () => {
      const fn = mockFetch([
        { status: 201, body: { runId: "r1", status: "pending" } },
      ]);

      await submitToLauncher(
        { profiles: ["a"], benchmark: "b" },
        { QA_AUTH_TOKEN: "tok" },
      );

      const calls = (fn as unknown as { mock: { calls: unknown[][] } }).mock
        .calls;
      const url = calls[0][0] as string;
      expect(url).toBe("https://qa.vellum.ai/api/evals/trigger");
    });
  });

  describe("pollLauncherStatus", () => {
    test("polls until terminal status and returns final response", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            runId: "r1",
            status: "pending",
            startedAt: null,
            finishedAt: null,
            podPhase: null,
            logsRef: "",
            resultsRef: "https://qa.test.example/evals/runs/r1",
          },
        },
        {
          status: 200,
          body: {
            runId: "r1",
            status: "running",
            startedAt: "2026-01-01T00:00:00Z",
            finishedAt: null,
            podPhase: "Running",
            logsRef: "",
            resultsRef: "https://qa.test.example/evals/runs/r1",
          },
        },
        {
          status: 200,
          body: {
            runId: "r1",
            status: "succeeded",
            startedAt: "2026-01-01T00:00:00Z",
            finishedAt: "2026-01-01T00:30:00Z",
            podPhase: null,
            logsRef: "",
            resultsRef: "https://qa.test.example/evals/runs/r1",
          },
        },
      ]);

      const statuses: string[] = [];
      const result = await pollLauncherStatus("r1", {
        env: TEST_ENV,
        intervalMs: 1,
        timeoutMs: 1000,
        onStatus: (s) => statuses.push(s.status),
      });

      expect(result?.status).toBe("succeeded");
      expect(statuses).toEqual(["pending", "running", "succeeded"]);
    });

    test("returns undefined when QA_AUTH_TOKEN is missing", async () => {
      const result = await pollLauncherStatus("r1", {
        env: {},
        intervalMs: 1,
        timeoutMs: 100,
      });
      expect(result).toBeUndefined();
    });

    test("returns last known status on timeout", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            runId: "r1",
            status: "running",
            startedAt: "2026-01-01T00:00:00Z",
            finishedAt: null,
            podPhase: "Running",
            logsRef: "",
            resultsRef: "https://qa.test.example/evals/runs/r1",
          },
        },
      ]);

      const result = await pollLauncherStatus("r1", {
        env: TEST_ENV,
        intervalMs: 1,
        timeoutMs: 50,
      });

      expect(result?.status).toBe("running");
    });
  });

  describe("dashboardBaseUrl", () => {
    test("uses EVAL_RESULTS_UPLOAD_URL when set", () => {
      expect(dashboardBaseUrl(TEST_ENV)).toBe("https://qa.test.example");
    });

    test("strips trailing slashes", () => {
      expect(
        dashboardBaseUrl({
          EVAL_RESULTS_UPLOAD_URL: "https://qa.test.example//",
          QA_AUTH_TOKEN: "x",
        }),
      ).toBe("https://qa.test.example");
    });

    test("defaults to https://qa.vellum.ai", () => {
      expect(dashboardBaseUrl({})).toBe("https://qa.vellum.ai");
    });
  });
});
