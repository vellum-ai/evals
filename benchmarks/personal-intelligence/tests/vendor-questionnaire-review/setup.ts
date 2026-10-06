import { join } from "node:path";

import { stageWorkspaceDir } from "../../../../src/lib/stage-workspace-dir";
import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { QUESTIONNAIRES_DIR } from "./constants";

// Stage the eight returned questionnaires, one file per vendor, about a
// hundred and thirty lines each. Independent of each other and
// individually weighty enough to look like a job worth handing out —
// the shape production traces fan out over hardest. `vendors.ts`,
// `truth.ts` and `generate.ts` next to them are metric ground truth and
// are NOT staged.
export default stageWorkspaceDir(
  join(
    import.meta.dir,
    "..",
    "..",
    "lib",
    "fixtures",
    "vendor-questionnaires",
    "questionnaires",
  ),
  { under: QUESTIONNAIRES_DIR },
) satisfies TestSetupCommand[];
