import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import {
  EP19_CHAPTER_LINES,
  EP19_EXPECTED_LINKS,
  EP19_FEED_GUID,
  EP19_SHOWNOTES_PATH,
  EP19_TITLE_LINE,
  FEED_WORKSPACE_PATH,
  SIGNOFF_LINE,
  SPONSOR_LINE,
} from "../constants";

const METRIC_NAME = "ep19-correct";

/**
 * Grades the SECOND performance — episode 19 — against the house format.
 * By this point the agent has already worked the procedure out once for
 * episode 18, so failures here are failures of procedural carryover, not
 * discovery. Each check targets one of the script's non-obvious rules.
 */
export default async function scoreEp19Correct(
  input: MetricInput,
): Promise<MetricResult> {
  let notes: string | undefined;
  let feed: string | undefined;
  try {
    [notes, feed] = await Promise.all([
      readAssistantWorkspaceFile(input.runId, EP19_SHOWNOTES_PATH),
      readAssistantWorkspaceFile(input.runId, FEED_WORKSPACE_PATH),
    ]);
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) throw err;
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot grade workspace deliverables.",
    };
  }
  if (notes === undefined) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `${EP19_SHOWNOTES_PATH} was never written.`,
    };
  }

  const dupLink = EP19_EXPECTED_LINKS[0];
  const inOrder = (haystack: string, needles: string[]): boolean => {
    let cursor = -1;
    for (const needle of needles) {
      const at = haystack.indexOf(needle, cursor + 1);
      if (at < 0) return false;
      cursor = at;
    }
    return true;
  };
  const checks: Record<string, boolean> = {
    titleZeroPadded: notes.includes(EP19_TITLE_LINE),
    sponsorBlockBeforeChapters:
      notes.includes(SPONSOR_LINE) &&
      notes.indexOf(SPONSOR_LINE) < notes.indexOf("## Chapters"),
    chaptersFlooredTo30s: inOrder(notes, EP19_CHAPTER_LINES),
    linksDedupedInOrder:
      inOrder(notes, EP19_EXPECTED_LINKS) &&
      notes.split(dupLink).length - 1 === 1,
    signoffPresent: notes.includes(SIGNOFF_LINE),
    feedEntryWithGuid: feed?.includes(EP19_FEED_GUID) ?? false,
  };
  const names = Object.keys(checks);
  const passed = names.filter((n) => checks[n]);
  return {
    name: METRIC_NAME,
    score: passed.length / names.length,
    reason:
      passed.length === names.length
        ? "Episode 19 notes and feed entry match the house format exactly."
        : `Failed: ${names.filter((n) => !checks[n]).join(", ")}.`,
    metadata: { checks },
  };
}
