import { afterAll, describe, expect, test } from "bun:test";

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { resolveAssistantSource } from "../adapters/vellum";

/**
 * The default the adapter derives from its own file location: the parent
 * repo of this evals checkout. Recomputed here from this test file's
 * location (`src/lib/__tests__` → repo-root parent via four `..`s) so the
 * test pins the byte-identical-to-today contract without duplicating the
 * adapter's `import.meta.dir` arithmetic against the adapter's own dir.
 */
const DEFAULT_SOURCE = resolve(import.meta.dir, "..", "..", "..", "..");

/** Create a tempdir that looks like a vellum-assistant checkout. */
function makeAssistantTree(): string {
  const root = mkdtempSync(join(tmpdir(), "evals-assistant-source-"));
  mkdirSync(join(root, "assistant"), { recursive: true });
  writeFileSync(join(root, "assistant", "package.json"), "{}\n");
  return root;
}

const tempDirs: string[] = [];
function tracked(dir: string): string {
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveAssistantSource default", () => {
  test("no env override resolves to the parent repo of this checkout", () => {
    expect(resolveAssistantSource({})).toBe(DEFAULT_SOURCE);
  });

  test("empty and whitespace-only overrides are treated as unset", () => {
    expect(resolveAssistantSource({ EVALS_ASSISTANT_SOURCE: "" })).toBe(
      DEFAULT_SOURCE,
    );
    expect(resolveAssistantSource({ EVALS_ASSISTANT_SOURCE: "   " })).toBe(
      DEFAULT_SOURCE,
    );
  });
});

describe("resolveAssistantSource override", () => {
  test("a valid assistant tree wins over the default", () => {
    // The fixture tree has assistant/package.json but no evals/ directory —
    // the shape of a parent-repo `git worktree` baseline checkout (evals/
    // is gitignored by the parent) — and must be accepted as-is.
    const root = tracked(makeAssistantTree());
    expect(resolveAssistantSource({ EVALS_ASSISTANT_SOURCE: root })).toBe(
      resolve(root),
    );
  });

  test("a relative path is resolved to absolute", () => {
    // `resolve` of the cwd itself round-trips "." deterministically; the
    // cwd is not an assistant tree, so assert on the error's resolved path
    // to prove relative → absolute resolution happened before validation.
    expect(() =>
      resolveAssistantSource({ EVALS_ASSISTANT_SOURCE: "./no-such-dir-xyz" }),
    ).toThrow(resolve("./no-such-dir-xyz"));
  });
});

describe("resolveAssistantSource errors", () => {
  test("a missing path fails fast with the var name and resolved path", () => {
    expect(() =>
      resolveAssistantSource({ EVALS_ASSISTANT_SOURCE: "/bad/path" }),
    ).toThrow(/EVALS_ASSISTANT_SOURCE.*"\/bad\/path".*does not exist/);
  });

  test("an existing dir that is not an assistant tree names the marker", () => {
    const root = tracked(mkdtempSync(join(tmpdir(), "evals-not-assistant-")));
    expect(() =>
      resolveAssistantSource({ EVALS_ASSISTANT_SOURCE: root }),
    ).toThrow(/not a vellum-assistant source tree.*assistant\/package\.json/);
  });

  test("error messages tell the operator how to fix the value", () => {
    expect(() =>
      resolveAssistantSource({ EVALS_ASSISTANT_SOURCE: "/bad/path" }),
    ).toThrow(/checkout or worktree/);
  });
});
