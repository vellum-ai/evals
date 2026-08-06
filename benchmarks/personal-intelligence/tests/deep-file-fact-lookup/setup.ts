import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Stage the generated mini-project: a catalog module whose 6,000-line
// price table carries a superseded 2025 pricing snapshot inside the
// default read window and the current table at line 5,200. Nothing in
// the workspace states either total; the answer requires reading past
// the truncation notice (or searching) to the current table.
const workspaceDir = join(import.meta.dir, "assets", "workspace");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );

const files: TestSetupCommand[] = walk(workspaceDir)
  .sort()
  .map((absPath) => ({
    type: "stage-workspace-file",
    path: relative(workspaceDir, absPath).split(sep).join("/"),
    content: readFileSync(absPath, "utf8"),
  }));

export default files satisfies TestSetupCommand[];
