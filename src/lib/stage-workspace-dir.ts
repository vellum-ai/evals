import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "./setup-command";

/**
 * Stage every file under `dir` into the agent's workspace: one
 * `stage-workspace-file` command per file, sorted by staged path for
 * deterministic ordering.
 *
 * Staged paths are always forward-slash separated regardless of host
 * platform — workspace paths are POSIX by contract, and building them
 * with `join()` would produce backslashes on Windows. `opts.under`
 * prefixes every staged path with a workspace-relative directory (e.g.
 * `"services"` stages `dir/foo/config.ts` at `services/foo/config.ts`).
 */
export function stageWorkspaceDir(
  dir: string,
  opts?: { under?: string },
): TestSetupCommand[] {
  const walk = (current: string, rel: string): { rel: string; abs: string }[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const abs = join(current, entry.name);
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      return entry.isDirectory()
        ? walk(abs, childRel)
        : [{ rel: childRel, abs }];
    });

  const prefix = opts?.under === undefined ? "" : `${opts.under}/`;
  return walk(dir, "")
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
    .map(({ rel, abs }) => ({
      type: "stage-workspace-file",
      path: `${prefix}${rel}`,
      content: readFileSync(abs, "utf8"),
    }));
}
