# Visualize Composition

Measures how the Vellum assistant composes inline visuals - the
`ui_show` tool with `surface_type: "visual"` plus the bundled
`visualize` skill.

## The pathology under test

The failure mode is not "the assistant declines to draw". It is that the
model **drafts the entire HTML/SVG fragment inside its reasoning
channel** before writing it into the tool call. That costs thousands of
thinking tokens per visual, adds tens of seconds of latency before
anything appears on screen, and in the worst case the turn hits
`max_tokens` mid-draft and the user sees nothing at all.

So the headline metric is `markup-in-thinking`: how much markup shows up
in thinking deltas. `visual-shown` and `time-to-visual` are the
outcome-side companions - a variant that suppresses the pathology but
also suppresses the visual has not fixed anything.

## Why the scenarios never ask for a visual

Every scenario asks one plain question - how a mechanism works, which of
two options to pick, what some numbers add up to, what the stages of a
process are - and then stops. None of them mentions a diagram, chart,
table, or picture, and each SPEC explicitly forbids the simulator from
asking for one or commenting on the reply's format.

Proactive visual use is part of what is being measured. A scenario that
asked for a chart would measure compliance instead, and would leak the
grading rubric into the prompt. For the same reason these SPECs carry no
"Success criteria (scored by metrics)" section - the simulator reads
SPEC.md verbatim as its system prompt, and telling it what the metrics
reward would contaminate the run.

Each scenario is a single turn: one user message, one full assistant
reply, done.

## Metrics

| Metric               | What it reads                                               | What it means                                                          |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `visual-shown`       | `ui_surface_show` events with `surfaceType: "visual"`       | Did a visual actually render. 1 or 0.                                  |
| `time-to-visual`     | User-message timestamp → first visual surface's `emittedAt` | Latency to first pixels. Decays hyperbolically past the baseline.      |
| `markup-in-thinking` | `assistant_thinking_delta` payloads                         | The headline pathology. Markup chars in the reasoning channel.         |
| `thinking-burn`      | Thinking chars before the first `ui_show` call              | Total reasoning spent ahead of committing to the tool call.            |
| `first-try-valid`    | `ui_show` `tool_result` events with `isError`               | Whether the first visual attempt passed validation, or needed retries. |

Every scenario scores the same five metrics; the per-scenario
`metrics/*.ts` files are one-line re-exports of the shared
implementations in `src/metrics/`.

## Profiles

The independent variable is the `visualize` SKILL.md the assistant sees:

- `vellum-viz-baseline` - the skill as it ships in the source build under
  test. Control arm.
- `vellum-viz-trailer`, `vellum-viz-slim` - each ships
  `workspace/skills/visualize/SKILL.md`, which shadows the bundled skill
  by directory id.
- `vellum-viz-glm` - baseline skill, different model. Separates
  "prompt-specific" from "model-specific". Only runnable with
  `FIREWORKS_API_KEY` set.

## Running

```bash
export EVALS_VELLUM_SOURCE=/absolute/path/to/vellum-assistant-checkout
bun run src/cli.ts run \
  --benchmark visualize-composition \
  --profiles vellum-viz-baseline,vellum-viz-trailer,vellum-viz-slim \
  --label "visualize-skill-ablation"
```
