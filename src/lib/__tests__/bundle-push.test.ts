import { describe, expect, test } from "bun:test";

import { pushBundleToUrl } from "../bundle-push";
import {
  ensureRunArtifacts,
  runArtifacts,
  writeMetricResults,
  writeRunMetadata,
} from "../metrics";

/** Seeds a minimal on-disk session (one run) so `buildRunBundle` succeeds. */
async function seedSession(): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sessionId = `push-sess-${suffix}`;
  const runId = `push-run-${suffix}`;
  await ensureRunArtifacts(runId);
  await writeRunMetadata(runId, {
    runId,
    sessionId,
    profileId: "p1",
    testId: "t1",
    status: "completed",
    startedAt: "2026-05-15T12:00:00.000Z",
    completedAt: "2026-05-15T12:00:02.000Z",
    artifactDir: runArtifacts(runId).runDir,
  });
  await writeMetricResults(runId, [
    { name: "accuracy", score: 1, reason: "scored" },
  ]);
  return sessionId;
}

/** A `fetch` stand-in that records its calls and resolves with `response`. */
function recordingFetch(response: Partial<Response>): {
  impl: typeof fetch;
  calls: { url: string; init: RequestInit | undefined }[];
} {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const impl = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ url: String(input), init });
    return response as Response;
  }) as typeof fetch;
  return { impl, calls };
}

const okResponse: Partial<Response> = {
  ok: true,
  json: async () => ({ id: "srv-1" }),
};

describe("pushBundleToUrl", () => {
  test("POSTs the bundle to <base>/api/evals/upload and returns the run's ids", async () => {
    // GIVEN a seeded session and a recording fetch that accepts the upload
    const sessionId = await seedSession();
    const { impl, calls } = recordingFetch(okResponse);

    // WHEN we push to a base URL
    const result = await pushBundleToUrl(sessionId, "https://qa.vellum.ai", {
      authToken: "tok-123",
      fetchImpl: impl,
    });

    // THEN the request targets the upload endpoint with a Bearer token
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://qa.vellum.ai/api/evals/upload");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toEqual({
      Authorization: "Bearer tok-123",
    });
    // AND the body is multipart form data carrying the bundle as `file`
    const body = calls[0]?.init?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(Blob);
    // AND the caller gets the server-assigned run id and its view URL
    expect(result).toEqual({
      runId: "srv-1",
      viewUrl: "https://qa.vellum.ai/evals/runs/srv-1",
    });
  });

  test("normalizes trailing slashes off the base URL", async () => {
    // GIVEN a base URL with trailing slashes
    const sessionId = await seedSession();
    const { impl, calls } = recordingFetch(okResponse);

    // WHEN we push
    const result = await pushBundleToUrl(sessionId, "https://qa.vellum.ai//", {
      authToken: "tok-123",
      fetchImpl: impl,
    });

    // THEN both the upload URL and the view URL are normalized
    expect(calls[0]?.url).toBe("https://qa.vellum.ai/api/evals/upload");
    expect(result.viewUrl).toBe("https://qa.vellum.ai/evals/runs/srv-1");
  });

  test("throws when no auth token is provided or in the environment", async () => {
    // GIVEN QA_AUTH_TOKEN is unset and no opts.authToken
    const saved = process.env.QA_AUTH_TOKEN;
    delete process.env.QA_AUTH_TOKEN;
    try {
      // WHEN/THEN pushing rejects with the setup guidance
      await expect(
        pushBundleToUrl("any-session", "https://qa.vellum.ai"),
      ).rejects.toThrow(/QA_AUTH_TOKEN is not set/);
    } finally {
      if (saved !== undefined) process.env.QA_AUTH_TOKEN = saved;
    }
  });

  test("throws with status and body text on a non-ok response", async () => {
    // GIVEN the server rejects the upload
    const sessionId = await seedSession();
    const { impl } = recordingFetch({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "try later",
    });

    // WHEN/THEN pushing surfaces the status line and body
    await expect(
      pushBundleToUrl(sessionId, "https://qa.vellum.ai", {
        authToken: "tok-123",
        fetchImpl: impl,
      }),
    ).rejects.toThrow("Upload failed (503 Service Unavailable): try later");
  });

  test("aborts a hung upload once timeoutMs elapses", async () => {
    // GIVEN a fetch that accepts the request but never responds, honoring
    // its abort signal
    const sessionId = await seedSession();
    const timeoutMs = 5;
    const seenSignals: Array<AbortSignal | null | undefined> = [];
    const hangingFetch = ((
      _input: string | URL | Request,
      init?: RequestInit,
    ) =>
      new Promise<Response>((_resolve, reject) => {
        seenSignals.push(init?.signal);
        // The timer behind AbortSignal.timeout() is unref'd, so if this
        // pending promise were the only work, Bun could exit the event loop
        // without ever firing it. A real (ref'd) setTimeout keeps the loop
        // alive long enough for the abort to fire, and doubles as a fallback
        // rejection so the test can never hang.
        const fallback = setTimeout(() => {
          reject(new Error("fake fetch: abort never fired"));
        }, timeoutMs + 200);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(fallback);
          reject(init.signal?.reason ?? new Error("aborted"));
        });
      })) as typeof fetch;

    // WHEN/THEN the push is aborted by its timeout instead of hanging
    const rejection = await pushBundleToUrl(sessionId, "https://qa.vellum.ai", {
      authToken: "tok-123",
      fetchImpl: hangingFetch,
      timeoutMs,
    }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).name).toBe("TimeoutError");
    // AND the fetch was handed an already-armed timeout signal
    expect(seenSignals).toHaveLength(1);
    expect(seenSignals[0]?.aborted).toBe(true);
  });

  test("propagates a fetch rejection", async () => {
    // GIVEN a fetch that fails outright
    const sessionId = await seedSession();
    const failingFetch = (async (
      _input: string | URL | Request,
    ): Promise<Response> => {
      throw new Error("network down");
    }) as typeof fetch;

    // WHEN/THEN the rejection reaches the caller unchanged
    await expect(
      pushBundleToUrl(sessionId, "https://qa.vellum.ai", {
        authToken: "tok-123",
        fetchImpl: failingFetch,
      }),
    ).rejects.toThrow("network down");
  });
});
