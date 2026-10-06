/**
 * Shared scorer for delegation restraint: did the run hand work to
 * subagents that it should have done itself?
 *
 * The delegation suite already scores the other half — whether a job wide
 * enough to pay for a fan-out actually got one. This is the half that
 * catches the opposite failure, which is the one a delegation-capable
 * assistant exhibits in the field: a worker spawned per phase of a small
 * job, or per item of a list of trivial items, each costing a briefing, a
 * fresh context, a wait and a read-back to save work smaller than the
 * briefing.
 *
 * Grading policy only — pure over the event stream, so it unit-tests
 * without Docker. A case supplies the two numbers that make the judgement
 * concrete: how many spawns the job is worth, and the count at which the
 * work has been handed away wholesale.
 */

import type { MetricInput, MetricResult, MetricScorer } from "../metrics";
import { readAssistantEvents } from "../metrics";
import { readSubagentSpawns, type SubagentSpawn } from "./subagent-activity";

/** The role an assistant's own subagent skill gives a blocking consult. */
const ADVISOR_ROLE = "advisor";

export interface SpawnRestraintOptions {
  /**
   * How many spawns this task is worth. Usually 0: a case that belongs in
   * this metric is one where delegation cannot pay for itself.
   */
  warranted: number;
  /**
   * The spawn count at which the score reaches zero — the point past
   * which this is not a judgement call gone slightly wrong but the job
   * handed away wholesale.
   */
  zeroAt: number;
  /** The job as one phrase, e.g. "a two-line fix", for the reason line. */
  job: string;
  /**
   * Names of the independent-looking items the workspace holds (packages,
   * documents, suppliers). A briefing that names one is evidence of a
   * per-item fan-out rather than a single delegated job, which is worth
   * seeing separately from the count.
   */
  itemNames?: readonly string[];
  /** What one of those items is called, e.g. "package". */
  itemNoun?: string;
  /** Metric name; defaults to `spawn-restraint`. */
  name?: string;
}

function itemsNamed(spawn: SubagentSpawn, items: readonly string[]): string[] {
  const haystack = `${spawn.label ?? ""} ${spawn.objective}`.toLowerCase();
  return items.filter((item) => haystack.includes(item.toLowerCase()));
}

function isAdvisor(spawn: SubagentSpawn): boolean {
  return (spawn.role ?? "").toLowerCase() === ADVISOR_ROLE;
}

/**
 * Build the scorer. `zeroAt` must be above `warranted`, or the score
 * would step from 1 to 0 with nothing in between and the metric would
 * report no gradient at all.
 */
/**
 * Score a set of spawns against what the job was worth. Pure: takes the
 * spawns rather than a run id, so the judgement is testable without a
 * run directory or a container.
 */
export function scoreSpawns(
  spawns: SubagentSpawn[],
  options: SpawnRestraintOptions,
): Omit<MetricResult, "name"> {
  const { warranted, zeroAt, job } = options;
  const itemNames = options.itemNames ?? [];
  const itemNoun = options.itemNoun ?? "item";
  if (zeroAt <= warranted) {
    throw new Error(
      `spawn-restraint needs zeroAt (${zeroAt}) above warranted (${warranted}).`,
    );
  }

  const advisors = spawns.filter(isAdvisor);
  const perItem = spawns.filter(
    (spawn) => itemsNamed(spawn, itemNames).length > 0,
  );
  const named = [
    ...new Set(perItem.flatMap((spawn) => itemsNamed(spawn, itemNames))),
  ].sort();

  const excess = Math.max(0, spawns.length - warranted);
  const score = Math.max(0, 1 - excess / (zeroAt - warranted));

  const reason =
    excess === 0
      ? `Did the job itself: ${spawns.length === 0 ? "no subagents" : `${spawns.length} subagent(s), within the ${warranted} this job is worth`} for ${job}.`
      : `Spawned ${spawns.length} subagent(s) for ${job}` +
        (advisors.length > 0
          ? `, ${advisors.length} of them advisor consult(s)`
          : "") +
        (named.length > 0
          ? `, ${perItem.length} briefed against ${named.length} named ${itemNoun}(s) (${named.join(", ")})`
          : "") +
        ".";

  return {
    score,
    reason,
    metadata: {
      spawnCount: spawns.length,
      warranted,
      zeroAt,
      advisorCount: advisors.length,
      workerCount: spawns.length - advisors.length,
      perItemSpawnCount: perItem.length,
      itemsNamed: named,
      roles: spawns.map((spawn) => spawn.role ?? null),
      labels: spawns.map((spawn) => spawn.label ?? null),
      objectives: spawns.map((spawn) => spawn.objective.slice(0, 300)),
    },
  };
}

/**
 * Build the scorer a case's `metrics/` directory default-exports: read
 * the run's own event stream, then apply {@link scoreSpawns} to what it
 * spawned.
 */
export function makeSpawnRestraintMetric(
  options: SpawnRestraintOptions,
): MetricScorer {
  const name = options.name ?? "spawn-restraint";
  // Validate the numbers at construction time, so a bad case fails when
  // its metric is loaded rather than after a run has been paid for.
  scoreSpawns([], options);

  return async function scoreSpawnRestraint(
    input: MetricInput,
  ): Promise<MetricResult> {
    const events = await readAssistantEvents(input.runId);
    return { name, ...scoreSpawns(readSubagentSpawns(events), options) };
  };
}
