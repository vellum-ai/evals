import { describe, expect, test } from "bun:test";

import { resolveSessionId } from "../session-id";

/** Shape of a generated id: `session-<17-digit ms timestamp>-<4 hex>`. */
const GENERATED_ID = /^session-\d{17}-[0-9a-f]{4}$/;

describe("generated session ids", () => {
  test("no explicit, no env, no label matches session-<ts>-<rand>", () => {
    expect(resolveSessionId({ env: {} })).toMatch(GENERATED_ID);
  });

  test("a label appends its slug", () => {
    const id = resolveSessionId({ env: {}, label: "My Fancy Label!" });
    expect(id).toMatch(/^session-\d{17}-[0-9a-f]{4}-my-fancy-label$/);
  });

  test("generated ids satisfy the externally-supplied-id contract", () => {
    // Round-trip: a generated id must be accepted verbatim when fed back
    // as an explicit --session-id (the launcher does exactly this).
    const generated = resolveSessionId({ env: {}, label: "Some Label" });
    expect(resolveSessionId({ explicit: generated, env: {} })).toBe(generated);
  });
});

describe("resolveSessionId precedence", () => {
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
    expect(id).toMatch(GENERATED_ID);
  });

  test("no explicit, no env falls back to the generated shape", () => {
    const id = resolveSessionId({ env: {}, label: "foo" });
    expect(id).toMatch(/^session-\d{17}-[0-9a-f]{4}-foo$/);
  });

  test("empty explicit id throws instead of falling back", () => {
    expect(() =>
      resolveSessionId({
        explicit: "",
        env: { EVAL_RESULTS_SESSION_ID: "env-id" },
      }),
    ).toThrow(/--session-id/);
  });

  test("whitespace-only explicit id throws instead of falling back", () => {
    expect(() =>
      resolveSessionId({
        explicit: "   ",
        env: { EVAL_RESULTS_SESSION_ID: "env-id" },
      }),
    ).toThrow(/--session-id/);
  });
});

describe("supplied-id validation", () => {
  const invalid = ["../escape", "a/b", "has space", "-leading-hyphen"];
  for (const id of invalid) {
    test(`rejects explicit ${JSON.stringify(id)} with a clear message`, () => {
      expect(() => resolveSessionId({ explicit: id, env: {} })).toThrow(
        /letters, digits, hyphen, underscore; must start alphanumeric; max 128 chars/,
      );
    });
  }

  test("rejects a 129-char id and accepts a 128-char id", () => {
    expect(() =>
      resolveSessionId({ explicit: "a".repeat(129), env: {} }),
    ).toThrow(/max 128 chars/);
    expect(resolveSessionId({ explicit: "a".repeat(128), env: {} })).toBe(
      "a".repeat(128),
    );
  });

  test("error message names the source and the offending value", () => {
    expect(() => resolveSessionId({ explicit: "a/b", env: {} })).toThrow(
      /--session-id.*"a\/b"/,
    );
    expect(() =>
      resolveSessionId({ env: { EVAL_RESULTS_SESSION_ID: "a/b" } }),
    ).toThrow(/EVAL_RESULTS_SESSION_ID.*"a\/b"/);
  });
});
