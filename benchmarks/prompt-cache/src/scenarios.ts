/**
 * Scenario definitions for the prompt-cache benchmark.
 *
 * Every turn is a fixed string. The benchmark measures cache behavior on a
 * large stable prefix (system prompt, tool schemas, workspace context), so
 * the user text only needs to be small, cheap, and identical across runs.
 * Anything model-authored or clock-derived would make two runs of the same
 * profile incomparable.
 *
 * `scenarios/<id>/SPEC.md` documents each scenario's observables and
 * thresholds for a human reader; this file is what the runner executes.
 */

export interface PromptCacheScenario {
  id: string;
  /** One-line summary, echoed into run progress. */
  summary: string;
  /** Fixed user turns, sent in order against one conversation. */
  turns: readonly string[];
}

const SHORT_CHAT: PromptCacheScenario = {
  id: "short-chat",
  summary: "Four short no-tool turns in one conversation",
  turns: [
    "Hello. Reply with a single short sentence and do not use any tools.",
    "What is the capital of France? Answer in a single short sentence and do not use any tools.",
    "Name three primary colors. Answer in a single short sentence and do not use any tools.",
    "Thanks. Say goodbye in a single short sentence and do not use any tools.",
  ],
};

const TOOL_LOOP: PromptCacheScenario = {
  id: "tool-loop",
  summary: "One short turn, then a turn containing a shell tool loop",
  turns: [
    "Hello. Reply with a single short sentence and do not use any tools.",
    "Use the bash tool to run `pwd`, then tell me in a single short sentence which directory it printed.",
  ],
};

export const PROMPT_CACHE_SCENARIOS: Readonly<
  Record<string, PromptCacheScenario>
> = {
  [SHORT_CHAT.id]: SHORT_CHAT,
  [TOOL_LOOP.id]: TOOL_LOOP,
};

export function resolveScenario(id: string): PromptCacheScenario {
  const scenario = PROMPT_CACHE_SCENARIOS[id];
  if (!scenario) {
    const known = Object.keys(PROMPT_CACHE_SCENARIOS).sort().join(", ");
    throw new Error(
      `Unknown prompt-cache scenario "${id}". Known scenarios: ${known}.`,
    );
  }
  return scenario;
}
