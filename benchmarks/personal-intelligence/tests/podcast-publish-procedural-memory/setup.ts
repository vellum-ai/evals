import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Same workspace as podcast-publish-skill — the proven pipeline script and
// the evidence trail of episodes 16 and 17 — plus the transcripts for BOTH
// unpublished episodes (18 and 19). The user will ask for them one at a
// time and never mention tooling; whether the agent turns chore one into a
// remembered procedure for chore two is the thing under test.
const asset = (name: string): string =>
  readFileSync(join(import.meta.dir, "assets", name), "utf8");

export default [
  {
    type: "stage-workspace-file",
    path: "episodes/ep016-transcript.txt",
    content: asset("ep016-transcript.txt"),
  },
  {
    type: "stage-workspace-file",
    path: "episodes/ep017-transcript.txt",
    content: asset("ep017-transcript.txt"),
  },
  {
    type: "stage-workspace-file",
    path: "episodes/ep018-transcript.txt",
    content: asset("ep018-transcript.txt"),
  },
  {
    type: "stage-workspace-file",
    path: "episodes/ep019-transcript.txt",
    content: asset("ep019-transcript.txt"),
  },
  {
    type: "stage-workspace-file",
    path: "scripts/build_shownotes.ts",
    content: asset("build_shownotes.ts"),
  },
  {
    type: "stage-workspace-file",
    path: "shownotes/ep016.md",
    content: asset("shownotes-ep016.md"),
  },
  {
    type: "stage-workspace-file",
    path: "shownotes/ep017.md",
    content: asset("shownotes-ep017.md"),
  },
  {
    type: "stage-workspace-file",
    path: "feed.xml",
    content: asset("feed.xml"),
  },
] satisfies TestSetupCommand[];
