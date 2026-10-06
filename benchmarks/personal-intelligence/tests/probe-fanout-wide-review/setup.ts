import { join } from "node:path";

import { stageWorkspaceDir } from "../../../../src/lib/stage-workspace-dir";
import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { QUESTIONNAIRES_DIR } from "./constants";

// Stage the wide arm: twenty-four questionnaires, about four thousand
// lines in total. Same fixture, same shape, three times the weight of
// the eight-document case next door.
export default stageWorkspaceDir(
  join(
    import.meta.dir,
    "..",
    "..",
    "lib",
    "fixtures",
    "vendor-questionnaires",
    "questionnaires-wide",
  ),
  { under: QUESTIONNAIRES_DIR },
) satisfies TestSetupCommand[];
