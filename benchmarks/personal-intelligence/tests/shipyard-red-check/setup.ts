import { join } from "node:path";

import { stageWorkspaceDir } from "../../../../src/lib/stage-workspace-dir";
import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { SHIPYARD_DIR } from "./constants";

// Stage the shop's repository: fourteen packages, each with its own
// module, its own tests and its own package.json, plus the check script
// the owner runs. Breadth is the point — the tree looks like fourteen
// independent jobs and is in fact one two-line fix. `packages.ts`,
// `truth.ts` and `generate.ts` next to the project are metric ground
// truth and are deliberately NOT staged.
export default stageWorkspaceDir(
  join(import.meta.dir, "..", "..", "lib", "fixtures", "shipyard", "project"),
  { under: SHIPYARD_DIR },
) satisfies TestSetupCommand[];
