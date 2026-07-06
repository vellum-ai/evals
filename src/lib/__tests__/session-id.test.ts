import { describe, expect, test } from "bun:test";

import {
  SESSION_ID_PATTERN,
  assertValidSessionId,
  generateSessionId,
  resolveSessionId,
  sessionTimestampSuffix,
} from "../session-id";

describe("session id generation", () => {
  test("generated id without a label matches session-<ts>-<rand>", () => {
    const id = generateSessionId(undefined, sessionTimestampSuffix());
    expect(id).toMatch(/^session-\d{17}-[0-9a-f]{4}$/);
  });

  test("generated id with a label appends the slug", () => {
    const id = generateSessionId("My Fancy Label!", sessionTimestampSuffix());
    expect(id).toMatch(/^session-\d{17}-[0-9a-f]{4}-my-fancy-label$/);
  });
});

describe("resolveSessionId", () => {
  test("explicit id wins over env and label, returned verbatim", () => {
    const id = resolveSessionId({
      explicit: "my-launcher-run-42",
      env: { EVAL_RESULTS_SESSION_ID: "env-id" },
      label: "some label",
    });
    expect(id).toBe("my-launcher-run-42");
  });

  test("env fallback is used when no explicit id, label ignored", () => {
    const id = resolveSessionId({
      env: { EVAL_RESULTS_SESSION_ID: "abc123" },
      label: "some label",
    });
    expect(id).toBe("abc123");
  });

  test("whitespace-only env value is treated as unset", () => {
    const id = resolveSessionId({ env: { EVAL_RESULTS_SESSION_ID: "   " } });
    expect(id).toMatch(/^session-\d{17}-[0-9a-f]{4}$/);
  });

  test("no explicit, no env falls back to the generated shape", () => {
    const id = resolveSessionId({ env: {}, label: "foo" });
    expect(id).toMatch(/^session-\d{17}-[0-9a-f]{4}-foo$/);
  });

  test("invalid explicit id names the flag", () => {
    expect(() => resolveSessionId({ explicit: "../escape", env: {} })).toThrow(
      /--session-id/,
    );
  });

  test("invalid env id names the env var", () => {
    expect(() =>
      resolveSessionId({ env: { EVAL_RESULTS_SESSION_ID: "a/b" } }),
    ).toThrow(/EVAL_RESULTS_SESSION_ID/);
  });
});

describe("SESSION_ID_PATTERN", () => {
  test("generated ids always satisfy the externally-supplied-id contract", () => {
    expect(
      SESSION_ID_PATTERN.test(
        generateSessionId(undefined, sessionTimestampSuffix()),
      ),
    ).toBe(true);
    expect(
      SESSION_ID_PATTERN.test(
        generateSessionId("Some Label", sessionTimestampSuffix()),
      ),
    ).toBe(true);
  });
});

describe("assertValidSessionId", () => {
  const invalid = ["../escape", "a/b", "has space", "", "-leading-hyphen"];
  for (const id of invalid) {
    test(`rejects ${JSON.stringify(id)} with a clear message`, () => {
      expect(() => assertValidSessionId(id, "--session-id")).toThrow(
        /letters, digits, hyphen, underscore; must start alphanumeric; max 128 chars/,
      );
    });
  }

  test("rejects a 129-char id and accepts a 128-char id", () => {
    expect(() => assertValidSessionId("a".repeat(129), "--session-id")).toThrow(
      /max 128 chars/,
    );
    expect(() =>
      assertValidSessionId("a".repeat(128), "--session-id"),
    ).not.toThrow();
  });

  test("error message names the source and the offending value", () => {
    expect(() => assertValidSessionId("a/b", "--session-id")).toThrow(
      /--session-id.*"a\/b"/,
    );
    expect(() =>
      assertValidSessionId("a/b", "EVAL_RESULTS_SESSION_ID"),
    ).toThrow(/EVAL_RESULTS_SESSION_ID.*"a\/b"/);
  });
});
