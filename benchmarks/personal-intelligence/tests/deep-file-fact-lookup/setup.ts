import { join } from "node:path";

import { stageWorkspaceDir } from "../../../../src/lib/stage-workspace-dir";
import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Stage the generated mini-project: a catalog module whose 6,000-line
// price table carries a superseded 2025 pricing snapshot inside the
// default read window and the current table at line 5,200. Nothing in
// the workspace states either total; the answer requires reading past
// the truncation notice (or searching) to the current table.
export default stageWorkspaceDir(
  join(import.meta.dir, "assets", "workspace"),
) satisfies TestSetupCommand[];
