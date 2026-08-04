import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Stage what came back from the summer teams: fifteen freezer manifests,
// two of which disagree with the rest — one repeats a sample another
// team already logged, one records in mL instead of µL. Nothing in the
// workspace flags either; they are only visible by reading across files.
const assetsDir = join(import.meta.dir, "assets");
const asset = (...parts: string[]): string =>
  readFileSync(join(assetsDir, ...parts), "utf8");

const manifests: TestSetupCommand[] = readdirSync(join(assetsDir, "manifests"))
  .filter((name) => name.endsWith(".csv"))
  .sort()
  .map((name) => ({
    type: "stage-workspace-file",
    path: `manifests/${name}`,
    content: asset("manifests", name),
  }));

export default manifests satisfies TestSetupCommand[];
