/**
 * Stage image fixtures into the agent's workspace.
 *
 * The Vellum adapter sends text only, so an image reaches the assistant
 * the way a saved file does: staged into the workspace before the
 * conversation starts, then read with `file_read`. PNG bytes ride the
 * base64 encoding of `stage-workspace-file`; a UTF-8 string payload
 * would corrupt them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../../src/lib/setup-command";
import { IMAGES_DIR } from "./content";

/** Stage the named committed PNGs under the same names in the workspace. */
export function stageFixtureImages(
  names: readonly string[],
): TestSetupCommand[] {
  return names.map((name) => ({
    type: "stage-workspace-file" as const,
    path: name,
    content: readFileSync(join(import.meta.dir, IMAGES_DIR, name)).toString(
      "base64",
    ),
    encoding: "base64" as const,
  }));
}
