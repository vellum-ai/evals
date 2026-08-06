import { join } from "node:path";

import { stageWorkspaceDir } from "../../../../src/lib/stage-workspace-dir";
import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Stage the platform's service-config tree: forty services/<name>/config.ts
// files plus the shared timeout constants two of them import. Three configs
// override their timeout later in the same file and two inherit it from
// services/shared/timeouts.ts — nothing in any single file's head flags
// either; the effective values only fall out of reading whole files.
export default stageWorkspaceDir(join(import.meta.dir, "assets", "services"), {
  under: "services",
}) satisfies TestSetupCommand[];
