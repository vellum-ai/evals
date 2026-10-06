import { join } from "node:path";

import { stageWorkspaceDir } from "../../../../src/lib/stage-workspace-dir";
import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { QUOTES_DIR } from "./constants";

// Stage the eight quotes the buyer collected, one plain-text file per
// supplier, each about twenty lines. Independent of each other and
// individually trivial: the shape that invites a worker per item and
// cannot possibly pay for one. `quotes.ts`, `truth.ts` and `generate.ts`
// next to the quotes are metric ground truth and are NOT staged.
export default stageWorkspaceDir(
  join(
    import.meta.dir,
    "..",
    "..",
    "lib",
    "fixtures",
    "supplier-quotes",
    "quotes",
  ),
  { under: QUOTES_DIR },
) satisfies TestSetupCommand[];
