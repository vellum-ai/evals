import { join } from "node:path";

import { stageWorkspaceDir } from "../../../../src/lib/stage-workspace-dir";
import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { TRACKER_DIR } from "./constants";

// Stage the shared expense-tracker project the user has been running: the
// CLI entry point, its commands, storage and formatting modules, its own
// unit tests, and the seeded data file, none of whose entries carry a
// category. `expected/` and `truth.ts` next to the project are metric
// ground truth and are deliberately NOT staged.
export default stageWorkspaceDir(
  join(
    import.meta.dir,
    "..",
    "..",
    "lib",
    "fixtures",
    "expense-tracker",
    "project",
  ),
  { under: TRACKER_DIR },
) satisfies TestSetupCommand[];
