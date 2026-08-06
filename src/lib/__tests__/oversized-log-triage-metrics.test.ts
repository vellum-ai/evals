import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import { gradeIncidentAnswer } from "../../../benchmarks/personal-intelligence/tests/oversized-log-triage/metrics/incident-answer-correct";
import { gradeSpoolRecovery } from "../../../benchmarks/personal-intelligence/tests/oversized-log-triage/metrics/spool-recovery";

/** A direct tool call, the wire shape (see tool-activity.test.ts). */
function direct(toolName: string, input: Record<string, unknown>): AgentEvent {
  return { message: { type: "tool_use_start", toolName, input } };
}

/** A tool result. The Vellum daemon's carries no toolUseId. */
function result(text: string): AgentEvent {
  return { message: { type: "tool_result", result: text } };
}

/** The spool stub the assistant swaps in for an oversized result. */
const SPOOL_STUB_RESULT =
  "line 1\nline 2\n\n...(51234 tokens omitted — full result: /workspace/.conversations/c1/.tool-results/ab12cd34ef56.txt — use file_read to view)\n";

const DEREF_PATH =
  "/workspace/.conversations/c1/.tool-results/ab12cd34ef56.txt";

describe("oversized-log-triage spool-recovery", () => {
  test("spooled then dereferenced scores 1", () => {
    // GIVEN a fat read whose result got spooled, then a deref read that
    // paged the content back in
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", { path: DEREF_PATH, offset: 38000 }),
      result("the incident window, inline"),
    ];

    // WHEN graded
    const graded = gradeSpoolRecovery(events);

    // THEN the round-trip counts as recovered
    expect(graded.score).toBe(1);
    expect(graded.applicable).toBeUndefined();
    expect(graded.metadata).toMatchObject({
      spooledCount: 1,
      successfulDerefCount: 1,
    });
  });

  test("spooled then abandoned scores 0", () => {
    // GIVEN a spooled result the agent never dereferenced
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", { path: "/workspace/notes.md" }),
      result("something unrelated"),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.score).toBe(0);
    expect(graded.applicable).toBeUndefined();
    expect(graded.metadata).toMatchObject({
      spooledCount: 1,
      recoveredCount: 0,
      derefCount: 0,
    });
  });

  test("post-spool ranged re-reads of the spooled file are a recovery", () => {
    // GIVEN the other legitimate route the SPEC invites: never touch
    // the stub, re-read the log itself in explicit offset/limit slices
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", {
        path: "/workspace/logs/gateway.log",
        offset: 38000,
        limit: 500,
      }),
      result("the incident window, inline"),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.score).toBe(1);
    expect(graded.metadata).toMatchObject({
      spooledCount: 1,
      recoveredCount: 1,
      derefCount: 0,
    });
  });

  test("a default re-read that spools again is not a recovery", () => {
    // GIVEN the agent repeating the fat read and getting spooled again
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.score).toBe(0);
    expect(graded.metadata).toMatchObject({ spooledCount: 2 });
  });

  test("recovering only some spooled reads earns fractional credit", () => {
    // GIVEN two spooled reads with distinct stubs, one dereferenced and
    // one abandoned
    const secondStub =
      "...(41234 tokens omitted — full result: /workspace/.conversations/c1/.tool-results/ffee99.txt — use file_read to view)";
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", { path: "/workspace/logs/upstream.log" }),
      result(secondStub),
      direct("file_read", { path: DEREF_PATH, offset: 38000 }),
      result("the incident window, inline"),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.score).toBe(0.5);
    expect(graded.metadata).toMatchObject({
      spooledCount: 2,
      recoveredCount: 1,
    });
  });

  test("a deref read whose result never arrived is not a recovery", () => {
    // GIVEN a deref call with no paired result (0 chars came back)
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", { path: DEREF_PATH }),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.score).toBe(0);
    expect(graded.metadata).toMatchObject({
      derefCount: 1,
      successfulDerefCount: 0,
    });
  });

  test("an ERRORED deref is not a recovery", () => {
    // GIVEN a deref whose non-empty result is an error message — the
    // spooled content never came back
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", { path: DEREF_PATH }),
      {
        message: {
          type: "tool_result",
          result: "Error: file not found",
          isError: true,
        },
      } satisfies AgentEvent,
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.score).toBe(0);
    expect(graded.metadata).toMatchObject({
      derefCount: 1,
      successfulDerefCount: 0,
      recoveredCount: 0,
    });
  });

  test("an ERRORED ranged re-read is not a recovery either", () => {
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", {
        path: "/workspace/logs/gateway.log",
        offset: 38000,
        limit: 500,
      }),
      {
        message: {
          type: "tool_result",
          result: "Error: offset beyond end of file",
          isError: true,
        },
      } satisfies AgentEvent,
    ];

    expect(gradeSpoolRecovery(events).score).toBe(0);
  });

  test("a deref via another spelling of the spool path still recovers", () => {
    // GIVEN the stub names the absolute spool path but the deref read
    // used the workspace-relative spelling
    const events = [
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", {
        path: ".conversations/c1/.tool-results/ab12cd34ef56.txt",
      }),
      result("the incident window, inline"),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.score).toBe(1);
    expect(graded.metadata).toMatchObject({ recoveredCount: 1 });
  });

  test("never spooled is not applicable, and names the strategy", () => {
    // GIVEN a search-first run that never fat-read the log
    const events = [
      direct("code_search", { query: "ERROR checkout-service" }),
      result("logs/gateway.log:38601: ..."),
      direct("file_read", {
        path: "/workspace/logs/gateway.log",
        offset: 38550,
        limit: 100,
      }),
      result("a tight slice, inline"),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.applicable).toBe(false);
    expect(graded.metadata).toMatchObject({
      spooledCount: 0,
      codeSearchCalls: 1,
      strategy: "search-first",
    });
  });

  test("host_code_search also reads as the search-first strategy", () => {
    // GIVEN the host-tool variant of search — previously missed by a
    // hand-rolled name match
    const events = [
      direct("host_code_search", { query: "ERROR checkout-service" }),
      result("logs/gateway.log:38601: ..."),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.applicable).toBe(false);
    expect(graded.metadata).toMatchObject({
      codeSearchCalls: 1,
      strategy: "search-first",
    });
  });

  test("sliced reads with no searching are labeled as such", () => {
    const events = [
      direct("file_read", {
        path: "/workspace/logs/gateway.log",
        offset: 39900,
        limit: 100,
      }),
      result("the tail, inline"),
    ];

    const graded = gradeSpoolRecovery(events);

    expect(graded.applicable).toBe(false);
    expect(graded.metadata).toMatchObject({ strategy: "sliced-reads" });
  });
});

describe("oversized-log-triage incident-answer-correct", () => {
  test("both facts right scores 1", () => {
    const graded = gradeIncidentAnswer(
      'checkout-service logged 47 ERROR lines during the incident. The first was: "TLS handshake failed: upstream payments-gateway certificate expired".',
    );
    expect(graded.score).toBe(1);
    expect(graded.metadata).toMatchObject({ trapHit: false });
  });

  test("a paraphrased first message still counts", () => {
    // GIVEN the two tokens that only co-occur in the incident's first line
    const graded = gradeIncidentAnswer(
      "There were 47 errors; the first complained that the payments-gateway TLS certificate expired.",
    );
    expect(graded.score).toBe(1);
  });

  test("exactly one fact right scores 0.5", () => {
    const countOnly = gradeIncidentAnswer(
      "checkout-service logged 47 errors during the incident window.",
    );
    expect(countOnly.score).toBe(0.5);
    expect(countOnly.metadata).toMatchObject({
      countStated: true,
      messageStated: false,
    });

    const messageOnly = gradeIncidentAnswer(
      'The first error was "TLS handshake failed: upstream payments-gateway certificate expired"; I could not settle on an exact count.',
    );
    expect(messageOnly.score).toBe(0.5);
  });

  test("the trap burst's answer scores 0 and is flagged as trap-hit", () => {
    // GIVEN the answer a truncation-blind agent produces from the
    // default 2000-line window
    const graded = gradeIncidentAnswer(
      'checkout-service logged 14 ERROR lines. The first said "connection pool exhausted: checkout-db-2 refusing new connections".',
    );
    expect(graded.score).toBe(0);
    expect(graded.metadata).toMatchObject({
      trapHit: true,
      trapCountStated: true,
      trapMessageStated: true,
    });
  });

  test("no facts at all scores 0 without the trap flag", () => {
    const graded = gradeIncidentAnswer(
      "I could not determine the incident details from the log.",
    );
    expect(graded.score).toBe(0);
    expect(graded.metadata).toMatchObject({ trapHit: false });
  });

  test("47 embedded in a longer number or decimal does not count", () => {
    const graded = gradeIncidentAnswer(
      "The log spans 2470 requests with latency 3.47s on average.",
    );
    expect(graded.metadata).toMatchObject({ countStated: false });
  });

  test("47 as the integer part of a decimal does not count", () => {
    // The hand-rolled matcher's bug: `(?![\d:])` let 47 match inside
    // "47.5". The shared matcher's decimal guard must not.
    const graded = gradeIncidentAnswer(
      "Average response time was 47.5 ms during the window.",
    );
    expect(graded.metadata).toMatchObject({ countStated: false });
  });

  test("a quoted clock time does not read as the trap count", () => {
    // GIVEN "00:14:03" in the answer — the :14: must not match trap 14
    const graded = gradeIncidentAnswer(
      "The burst started around 00:14:03 last night.",
    );
    expect(graded.metadata).toMatchObject({ trapCountStated: false });
  });
});
