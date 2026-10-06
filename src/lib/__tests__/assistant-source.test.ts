import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describeAssistantSource } from "../assistant-source";

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "assistant-source-"));
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", "-C", dir, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
    });
  git("init", "-q");
  git("config", "user.email", "eval@example.test");
  git("config", "user.name", "Eval");
  writeFileSync(join(dir, "README.md"), "shipyard\n", "utf8");
  git("add", ".");
  git("commit", "-q", "-m", "the commit the run was built from");
  return dir;
}

describe("assistant source provenance", () => {
  test("a clean checkout records its commit and subject", () => {
    const record = describeAssistantSource(makeRepo());
    expect(record.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(record.subject).toBe("the commit the run was built from");
    expect(record.dirty).toBe(false);
  });

  test("an uncommitted change is recorded, because the commit no longer describes what ran", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "README.md"), "edited\n", "utf8");
    expect(describeAssistantSource(dir).dirty).toBe(true);
  });

  test("a path that is not a repository still records the path", () => {
    const dir = mkdtempSync(join(tmpdir(), "not-a-repo-"));
    const record = describeAssistantSource(dir);
    expect(record.path).toContain("not-a-repo-");
    expect(record.commit).toBeUndefined();
  });

  test("the path is absolute, so a run is readable from anywhere", () => {
    expect(describeAssistantSource(".").path.startsWith("/")).toBe(true);
  });
});
