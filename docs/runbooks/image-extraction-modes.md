# Runbook: caption mode vs handle-only mode on image extraction

How to measure detailed image extraction on a text-only model, and how
to compare the image-fallback plugin's two caption modes on the same
five cases.

All commands run from an `evals/` checkout with dependencies installed
(`bun install`, `.env` from `.env.example`) and Docker running.
`evals <cmd>` below means `bun run src/cli.ts <cmd>`.

## Context

When the active model cannot see images, the assistant's `image-fallback`
plugin decides what the model gets instead, and `imageFallback.captionMode`
picks between two shapes:

- `caption` (the default) describes every image with a vision profile
  before the turn, so the model reads a paragraph someone else wrote.
- `handle-only` replaces the image with a marker
  (`[Image "receipt.png" available via image_ask]`) and leaves the model
  to ask its own questions through the turn-scoped `image_ask` tool.

A caption is written before anyone knows what will be asked, so it
carries what a describer thought was salient. `image_ask` is asked after
the question exists. The five cases below are built where that difference
should show: they want a specific figure, a specific cell, a specific
string, or an honest "that is not in the image".

| Case id                     | What it measures                                              |
| --------------------------- | ------------------------------------------------------------- |
| `receipt-exact-total`       | An exact money total, to the cent, plus a line-item count     |
| `table-cell-lookup`         | Two named cells (one negative, one decimal) and a row max     |
| `chart-axis-read`           | A verbatim axis label and one named bar's printed value       |
| `ui-verbatim-text`          | A version string copied character for character, and an email |
| `image-absent-fact-honesty` | Saying "not in the image" instead of inventing a value        |

All five are `status: experimental`, so an unfiltered `evals run` skips
them: `--filter` is mandatory.

**The two profiles.** `vellum-glm-text-only-caption` and
`vellum-glm-text-only-handle-only` are identical apart from
`imageFallback.captionMode`, so a difference between them is the mode.
Both pin the conversation model to text-only GLM 5.2 on Fireworks
(`FIREWORKS_API_KEY` required) and leave the shipped Anthropic profile
enabled, which is what the fallback calls for vision (`ANTHROPIC_API_KEY`
required, as the simulator and judge need it anyway).

## Run both modes in one session

One session, both profiles, so the report's own per-profile aggregates
apply directly:

```bash
evals run \
  --profiles vellum-glm-text-only-caption,vellum-glm-text-only-handle-only \
  --filter receipt-exact-total,table-cell-lookup,chart-axis-read,ui-verbatim-text,image-absent-fact-honesty \
  --label image-extraction-modes \
  --session-id image-extraction-modes \
  --serve
```

`--serve` starts the local report server afterwards and opens the
session page. There is no `--repeat` flag, and a vision call is not
deterministic: run the command three times, bumping `--session-id`, and
read the median.

## Compare

Export the session and compare the two profiles inside it (the same file
on both sides, `--by profile`):

```bash
evals export --session image-extraction-modes --out runs/image-extraction-modes.jsonl
evals compare runs/image-extraction-modes.jsonl runs/image-extraction-modes.jsonl --by profile
```

That prints score, cost, tokens and runtime per profile. `--format
table|md|json` picks the shape.

To compare a change to the plugin against a baseline, run the same
command against each build (`EVALS_ASSISTANT_SOURCE=<worktree>`), export
both sessions, and compare them per test:

```bash
evals compare runs/baseline.jsonl runs/after-fix.jsonl
```

## Reading the result

Four things carry the signal, and they are meant to be read together:

- **Accuracy.** `total-exact`, `line-item-count`, `cell-values`,
  `highest-q3-region`, `axis-label-verbatim`, `bar-value`,
  `version-string-verbatim`, `email-verbatim`. Each metric's metadata
  carries what the answer actually claimed, so a miss is legible as the
  specific mistake (the subtotal instead of the total, a dropped minus
  sign, a rounded decimal, a re-cased version string).
- **Honesty.** `absent-fact-honesty` and `photo-text-honesty` on
  `image-absent-fact-honesty`. These are the metrics that punish a
  confident invention, which is the failure a caption written before the
  question is most likely to produce.
- **`image-ask-usage`.** Diagnostic, not pass/fail. Its metadata carries
  `imageAskCallCount`, `visionToolCallCount`, the questions asked and the
  images they targeted. Handle-only runs should show calls (there is no
  other route to the pixels); caption runs show whether the model went
  back for a second look after reading the description.
- **Cost and latency.** The session page's per-profile aggregates and
  the `costUsd` / `runtimeMs` columns of `evals compare`. Both come from
  the harness's own pricing of jail-recorded traffic, so they include the
  vision calls each mode makes. Handle-only trades an up-front caption
  per image for one call per question, and this is where that trade
  shows up.

An accuracy win that costs several extra vision calls per turn is a real
result, not a free one: read the accuracy delta and the cost delta as one
number.

## Regenerating the fixtures

The five PNGs are generated, and the generator is the source of truth:

```bash
bun benchmarks/personal-intelligence/lib/fixtures/image-extraction/generate.ts
```

It draws every figure from `content.ts`, which the cases' `constants.ts`
files re-export, so an image and the answers it is graded against cannot
drift apart. It is idempotent: a changed PNG after running it means they
had drifted. `bun test src/lib/__tests__/image-extraction-fixtures.test.ts`
holds that line, comparing each committed file against a fresh render on
decoded pixels.
