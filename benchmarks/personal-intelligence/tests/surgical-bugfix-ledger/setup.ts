import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { REPORT_FILE, TARGET_FILE } from "./constants";

// Stage the buggy ledger project the user has been running: the ~3,000-line
// ledger lib (one planted single-line bug) and the tiny report entry point.
// `assets/expected-fixed/` is metric ground truth and is deliberately NOT
// staged.
const assetsDir = join(import.meta.dir, "assets");
const asset = (...parts: string[]): string =>
  readFileSync(join(assetsDir, ...parts), "utf8");

const project: TestSetupCommand[] = [
  {
    type: "stage-workspace-file",
    path: TARGET_FILE,
    content: asset("project", "src", "ledger.ts"),
  },
  {
    type: "stage-workspace-file",
    path: REPORT_FILE,
    content: asset("project", "report.ts"),
  },
];

export default project satisfies TestSetupCommand[];
