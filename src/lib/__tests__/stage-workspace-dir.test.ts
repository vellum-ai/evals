import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stageWorkspaceDir } from "../stage-workspace-dir";

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "stage-workspace-"));
  mkdirSync(join(dir, "beta", "nested"), { recursive: true });
  writeFileSync(join(dir, "alpha.ts"), "alpha content");
  writeFileSync(join(dir, "beta", "nested", "deep.ts"), "deep content");
  writeFileSync(join(dir, "beta", "config.ts"), "beta config");
  return dir;
}

describe("stageWorkspaceDir", () => {
  test("stages every file with forward-slash paths, sorted", () => {
    const staged = stageWorkspaceDir(fixtureDir());
    expect(
      staged.map((cmd) =>
        cmd.type === "stage-workspace-file" ? cmd.path : "",
      ),
    ).toEqual(["alpha.ts", "beta/config.ts", "beta/nested/deep.ts"]);
    expect(staged[0]).toMatchObject({
      type: "stage-workspace-file",
      content: "alpha content",
    });
  });

  test("`under` prefixes staged paths with a workspace directory", () => {
    const staged = stageWorkspaceDir(fixtureDir(), { under: "services" });
    expect(
      staged.map((cmd) =>
        cmd.type === "stage-workspace-file" ? cmd.path : "",
      ),
    ).toEqual([
      "services/alpha.ts",
      "services/beta/config.ts",
      "services/beta/nested/deep.ts",
    ]);
  });
});
