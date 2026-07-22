import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";

import { SCREENSHOT_FILENAMES } from "./constants";

// Stage the committed transaction screenshots into the agent's workspace
// before the conversation starts, modelling the images the user "already
// sent". PNG/JPEG bytes ride the base64 encoding of `stage-workspace-file`
// (a UTF-8 string payload would corrupt them).
export default SCREENSHOT_FILENAMES.map((filename) => ({
  type: "stage-workspace-file" as const,
  path: filename,
  content: readFileSync(join(import.meta.dir, "assets", filename)).toString(
    "base64",
  ),
  encoding: "base64" as const,
})) satisfies TestSetupCommand[];
