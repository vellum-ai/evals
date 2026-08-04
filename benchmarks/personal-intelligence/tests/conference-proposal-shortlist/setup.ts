import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Stage the organiser's inbox after the CFP closed: 38 proposals, and
// the sponsor blurb that phase 2 comes back to fix.
const assetsDir = join(import.meta.dir, "assets");
const asset = (...parts: string[]): string =>
  readFileSync(join(assetsDir, ...parts), "utf8");

const proposals: TestSetupCommand[] = readdirSync(join(assetsDir, "proposals"))
  .filter((name) => name.endsWith(".md"))
  .sort()
  .map((name) => ({
    type: "stage-workspace-file",
    path: `proposals/${name}`,
    content: asset("proposals", name),
  }));

export default [
  ...proposals,
  {
    type: "stage-workspace-file",
    path: "sponsor-blurb.md",
    content: asset("sponsor-blurb.md"),
  },
] satisfies TestSetupCommand[];
