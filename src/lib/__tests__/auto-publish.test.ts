import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { autoPublishSession } from "../auto-publish";
import type { pushBundleToUrl } from "../bundle-push";
import { NoSessionError } from "../report-bundle";

type PushCall = {
  sessionId: string;
  outUrl: string;
  opts: Parameters<typeof pushBundleToUrl>[2];
};

/** An injected push stub that records its calls and resolves/rejects. */
function recordingPush(opts?: { rejectWith?: Error }): {
  push: typeof pushBundleToUrl;
  calls: PushCall[];
} {
  const calls: PushCall[] = [];
  const push = (async (
    sessionId: string,
    outUrl: string,
    pushOpts?: Parameters<typeof pushBundleToUrl>[2],
  ) => {
    calls.push({ sessionId, outUrl, opts: pushOpts });
    if (opts?.rejectWith) throw opts.rejectWith;
    return {
      runId: "srv-1",
      viewUrl: "https://qa.example.com/evals/runs/srv-1",
    };
  }) as typeof pushBundleToUrl;
  return { push, calls };
}

const consoleSpies: Array<ReturnType<typeof spyOn>> = [];

function spyConsole(method: "log" | "warn" | "error") {
  const spy = spyOn(console, method).mockImplementation(() => {});
  consoleSpies.push(spy);
  return spy;
}

afterEach(() => {
  for (const spy of consoleSpies.splice(0)) spy.mockRestore();
});

describe("autoPublishSession", () => {
  test("no upload URL → 'disabled', no push, no warnings", async () => {
    // GIVEN an env with no EVAL_RESULTS_UPLOAD_URL
    const warn = spyConsole("warn");
    const error = spyConsole("error");
    const { push, calls } = recordingPush();

    // WHEN we try to auto-publish
    const result = await autoPublishSession({
      sessionId: "sess-1",
      env: {},
      push,
    });

    // THEN publishing is silently disabled
    expect(result).toBe("disabled");
    expect(calls).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  test("whitespace-only upload URL → 'disabled', no push, no warnings", async () => {
    // GIVEN an env where the URL is set but blank
    const warn = spyConsole("warn");
    const { push, calls } = recordingPush();

    // WHEN we try to auto-publish
    const result = await autoPublishSession({
      sessionId: "sess-1",
      env: { EVAL_RESULTS_UPLOAD_URL: "   " },
      push,
    });

    // THEN it is treated the same as unset
    expect(result).toBe("disabled");
    expect(calls).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  test("URL without token → 'skipped-no-token', loud warning naming the session", async () => {
    // GIVEN an env with the URL but no QA_AUTH_TOKEN
    const warn = spyConsole("warn");
    const { push, calls } = recordingPush();

    // WHEN we try to auto-publish
    const result = await autoPublishSession({
      sessionId: "sess-2",
      env: { EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com" },
      push,
    });

    // THEN nothing is pushed and the warning names the session
    expect(result).toBe("skipped-no-token");
    expect(calls).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("QA_AUTH_TOKEN is missing");
    expect(message).toContain("sess-2");
    expect(message).toContain("will NOT appear on the dashboard");
  });

  test("whitespace-only token → 'skipped-no-token', warning fired", async () => {
    // GIVEN an env where the token is set but blank
    const warn = spyConsole("warn");
    const { push, calls } = recordingPush();

    // WHEN we try to auto-publish
    const result = await autoPublishSession({
      sessionId: "sess-3",
      env: {
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com",
        QA_AUTH_TOKEN: "  ",
      },
      push,
    });

    // THEN it is treated the same as a missing token
    expect(result).toBe("skipped-no-token");
    expect(calls).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("URL and token set → pushes (sessionId, trimmedUrl, { authToken }) → 'published'", async () => {
    // GIVEN a fully configured env (with whitespace to trim)
    const log = spyConsole("log");
    const error = spyConsole("error");
    const { push, calls } = recordingPush();

    // WHEN we auto-publish
    const result = await autoPublishSession({
      sessionId: "sess-4",
      env: {
        EVAL_RESULTS_UPLOAD_URL: "  https://qa.example.com/  ",
        QA_AUTH_TOKEN: " tok-123 ",
      },
      push,
    });

    // THEN the push gets the trimmed URL and the explicit token
    expect(result).toBe("published");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      sessionId: "sess-4",
      outUrl: "https://qa.example.com/",
      opts: { authToken: "tok-123" },
    });
    // AND the success line points at the pushed run's view URL
    expect(log).toHaveBeenCalledWith(
      "[evals] published session sess-4 → https://qa.example.com/evals/runs/srv-1",
    );
    expect(error).not.toHaveBeenCalled();
  });

  test("push throwing → 'failed', console.error with session id and message, nothing thrown", async () => {
    // GIVEN a push that rejects
    const error = spyConsole("error");
    const { push } = recordingPush({
      rejectWith: new Error(
        "Upload failed (503 Service Unavailable): try later",
      ),
    });

    // WHEN we auto-publish
    const result = await autoPublishSession({
      sessionId: "sess-5",
      env: {
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com",
        QA_AUTH_TOKEN: "tok-123",
      },
      push,
    });

    // THEN the failure is reported, not thrown
    expect(result).toBe("failed");
    expect(error).toHaveBeenCalledTimes(1);
    const message = String(error.mock.calls[0]?.[0]);
    expect(message).toContain("bundle publish failed for session sess-5");
    expect(message).toContain(
      "Upload failed (503 Service Unavailable): try later",
    );
  });

  test("session with no runs on disk → 'failed' with a distinct nothing-to-publish message", async () => {
    // GIVEN a push that finds no session on disk (every execution failed
    // before producing artifacts, so no run.json exists)
    const error = spyConsole("error");
    const { push } = recordingPush({
      rejectWith: new NoSessionError("sess-6"),
    });

    // WHEN we auto-publish
    const result = await autoPublishSession({
      sessionId: "sess-6",
      env: {
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com",
        QA_AUTH_TOKEN: "tok-123",
      },
      push,
    });

    // THEN it still counts as failed (exit code 1), but the message says
    // nothing was recorded rather than implying an upload/infra failure
    expect(result).toBe("failed");
    expect(error).toHaveBeenCalledTimes(1);
    const message = String(error.mock.calls[0]?.[0]);
    expect(message).toContain("nothing to publish for session sess-6");
    expect(message).toContain("no runs were recorded on disk");
    expect(message).not.toContain("bundle publish failed");
  });
});
