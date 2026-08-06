import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Stage the platform's service-config tree: forty services/<name>/config.ts
// files plus the shared timeout constants two of them import. Three configs
// override their timeout later in the same file and two inherit it from
// services/shared/timeouts.ts — nothing in any single file's head flags
// either; the effective values only fall out of reading whole files.
const assetsDir = join(import.meta.dir, "assets");

const staged: TestSetupCommand[] = readdirSync(join(assetsDir, "services"), {
  recursive: true,
})
  .map(String)
  .filter((name) => name.endsWith(".ts"))
  .sort()
  .map((name) => ({
    type: "stage-workspace-file",
    path: join("services", name),
    content: readFileSync(join(assetsDir, "services", name), "utf8"),
  }));

export default staged satisfies TestSetupCommand[];
