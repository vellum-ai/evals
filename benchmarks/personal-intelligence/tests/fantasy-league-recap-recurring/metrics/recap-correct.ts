import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import {
  WEEK8_JUGGERNAUT,
  WEEK8_RECAP_PATH,
  WEEK8_SACKO,
  WEEK8_STANDINGS_ORDER,
} from "../constants";

const METRIC_NAME = "recap-correct";

/** Team names from the standings table's rank rows, in printed order. */
function parseStandings(recap: string): string[] {
  const names: string[] = [];
  for (const match of recap.matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|/gm)) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Grades the week-8 recap against ground truth. The two tiebreak checks
 * are split out so a run that re-derived standings with plausible-but-
 * wrong rules (points-for sorting) fails visibly on exactly those rows.
 */
export default async function scoreRecapCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  let recap: string | undefined;
  try {
    recap = await readAssistantWorkspaceFile(input.runId, WEEK8_RECAP_PATH);
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) throw err;
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot grade workspace deliverables.",
    };
  }
  if (recap === undefined) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `${WEEK8_RECAP_PATH} was never written.`,
    };
  }

  const order = parseStandings(recap);
  const rank = (team: string) => order.indexOf(team);
  const before = (a: string, b: string) =>
    rank(a) >= 0 && rank(b) >= 0 && rank(a) < rank(b);
  const checks: Record<string, boolean> = {
    standingsExactOrder:
      order.length === WEEK8_STANDINGS_ORDER.length &&
      order.every((team, i) => team === WEEK8_STANDINGS_ORDER[i]),
    headToHeadTiebreak: before("Draft Punk", "Victory Formation"),
    pointsAgainstTiebreak: before("Bench Mob", "Punt Intended"),
    sackoCorrect: new RegExp(
      `Sacko[\\s\\S]{0,200}${WEEK8_SACKO}|${WEEK8_SACKO}[\\s\\S]{0,100}Sacko`,
    ).test(recap),
    juggernautCorrect: new RegExp(
      `Juggernaut[\\s\\S]{0,200}${WEEK8_JUGGERNAUT}|${WEEK8_JUGGERNAUT}[\\s\\S]{0,100}straight`,
    ).test(recap),
  };
  const names = Object.keys(checks);
  const passed = names.filter((n) => checks[n]);
  return {
    name: METRIC_NAME,
    score: passed.length / names.length,
    reason:
      passed.length === names.length
        ? "Week 8 recap matches ground truth, both planted tiebreaks included."
        : `Failed: ${names.filter((n) => !checks[n]).join(", ")}.`,
    metadata: { checks, parsedStandings: order },
  };
}
