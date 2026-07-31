import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import {
  EP18_CHAPTER_LINES,
  EP18_EXPECTED_LINKS,
  EP18_FEED_GUID,
  EP18_SHOWNOTES_PATH,
  EP18_TITLE_LINE,
  FEED_WORKSPACE_PATH,
  SIGNOFF_LINE,
  SPONSOR_LINE,
} from "../constants";

const METRIC_NAME = "shownotes-correct";

/**
 * Grades the episode-18 deliverable against the house format the fixture
 * script produces. Each check targets one of the script's non-obvious
 * rules, so a from-memory reimplementation loses exactly the checks whose
 * rule it failed to infer (30s chapter flooring, link dedupe, padding).
 */
export default async function scoreShownotesCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  let notes: string | undefined;
  let feed: string | undefined;
  try {
    [notes, feed] = await Promise.all([
      readAssistantWorkspaceFile(input.runId, EP18_SHOWNOTES_PATH),
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
      reason: `${EP18_SHOWNOTES_PATH} was never written.`,
    };
  }

  // The transcript repeats this link; deduped notes list it exactly once.
  const dupLink = EP18_EXPECTED_LINKS[0];
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
    titleZeroPadded: notes.includes(EP18_TITLE_LINE),
    sponsorBlockBeforeChapters:
      notes.includes(SPONSOR_LINE) &&
      notes.indexOf(SPONSOR_LINE) < notes.indexOf("## Chapters"),
    chaptersFlooredTo30s: inOrder(notes, EP18_CHAPTER_LINES),
    linksDedupedInOrder:
      inOrder(notes, EP18_EXPECTED_LINKS) &&
      notes.split(dupLink).length - 1 === 1,
    signoffPresent: notes.includes(SIGNOFF_LINE),
    feedEntryWithGuid: feed?.includes(EP18_FEED_GUID) ?? false,
  };
  const names = Object.keys(checks);
  const passed = names.filter((n) => checks[n]);
  return {
    name: METRIC_NAME,
    score: passed.length / names.length,
    reason:
      passed.length === names.length
        ? "Episode 18 notes and feed entry match the house format exactly."
        : `Failed: ${names.filter((n) => !checks[n]).join(", ")}.`,
    metadata: { checks },
  };
}
