# Runbook: measuring subagent overuse

How to reproduce excessive subagent delegation against a pre-fix
assistant, and how to check a fix actually removed it.

All commands run from an `evals/` checkout with dependencies installed
(`bun install`) and Docker running.

## Context

**What "overuse" means here.** Not "delegated at all" — the delegation
suite (`conference-proposal-shortlist`,
`contractor-invoice-audit-brief`, `lab-freezer-inventory-totals`) already
scores whether a job wide enough to pay for a fan-out gets one. Overuse
is the opposite failure: workers spawned where the briefing costs more
than the work. Two cases measure it.

| Case id                   | The trap                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| `shipyard-red-check`      | 14-package repo, one failing check, two-line fix — role/phase decomposition |
| `supplier-quote-verdicts` | 8 named independent quotes, three multiplications each — per-item fan-out   |

Both are `status: experimental`, so an unfiltered `evals run` skips them:
`--filter` is mandatory.

**Why these two shapes.** From 30 days of production telemetry
(`vellum-ai-prod.telemetry.tool_executed_raw` and `pii_turn_raw`):
15,440 `subagent_spawn` calls across 4,284 conversations, with a tail of
225 conversations spawning 11 or more. What predicts a many-spawn turn:

- **Role/phase decomposition of one job** — 75% of spawn objectives carry
  investigate / advise / review / implement language. This is the common
  case, and it does not need a wide workspace at all.
- **The `subagent` skill being loaded in-turn** — present before 60% of
  all spawn turns and 79% of turns with four or more spawns, against 1%
  of a matched control sample. `subagent` is in the daemon's
  `DEFAULT_PREACTIVATED_SKILL_IDS`, so no fixture has to arrange it.
- **An ask naming N independent items** — a clean dose-response, 8.9% of
  control turns against 23% of turns with six or more spawns.

What does **not** predict it, tested and rejected: a large directory
listing or search result before the burst, a checklist-shaped request
(that is the control side's own signature), a long conversation, or a
large tool surface. One-worker-per-file over a just-discovered file list
was not observed in any burst examined.

So `shipyard-red-check` targets the first mechanism and
`supplier-quote-verdicts` the third. Neither needs network access: the
fan-out is the behaviour under test, not what the workers would have
fetched.

**The assistant fixes under test** (parent repo):

- `eec181537b` — remove the `01-delegate-subagents` system-prompt section
  ("make delegating your default, not a last resort"; "an unnecessary
  subagent is cheaper than serialized work")
- `bf8c7d7c83` — scale the subagent skill's guidance to task size, drop
  the mandated pre-build and pre-completion advisor consults, and run the
  remaining consult on a written brief rather than the full transcript

**Baseline commit: `65bf2a2101`** — the direct parent of `eec181537b`,
the first fix. Building the assistant from this commit gives the last
pre-fix state of main with nothing else missing.

## What the pre-fix baseline actually did (2026-08-18)

Every case below ran against the pre-fix build (`65bf2a2101`), confirmed
by the `assistantSource` field the run artifacts now record. **No case
produced a single subagent.**

| Profile (conversation model)         | Case                          | Spawns | Task done |
| ------------------------------------ | ----------------------------- | ------ | --------- |
| `vellum-default` (claude-sonnet-4-6) | `shipyard-red-check`          | 0      | 1.00      |
| `vellum-default`                     | `supplier-quote-verdicts`     | 0      | 1.00      |
| `vellum-default`                     | `vendor-questionnaire-review` | 0      | 1.00      |
| `vellum-default`                     | `probe-fanout-wide-review`    | 0      | 1.00      |
| `vellum-balanced-glm52` (GLM 5.2)    | `shipyard-red-check`          | 0      | 1.00      |
| `vellum-balanced-glm52`              | `supplier-quote-verdicts`     | 0      | 1.00      |
| `vellum-balanced-glm52`              | `vendor-questionnaire-review` | 0      | 1.00      |
| `vellum-balanced-glm52`              | `probe-fanout-wide-review`    | 0      | 0.67      |

The widest case reads twenty-four documents and about four thousand
lines; GLM took 146k input tokens through the parent context rather than
delegate any of it. Two earlier probes in the same family
(`probe-spawn-breadth`, `probe-spawn-testloop`) also returned zero.

**`probe-subagent-capability` separates the two readings of that.** With
the user asking for parallel workers outright, the same build spawns
immediately — `skill_load` on the `subagent` skill, then four
`researcher` workers batched two vendors each, which is the fan-out
signature production traces show verbatim. So delegation works in this
harness. The zeros above are the model's judgement, not a missing
capability, and the pre-fix guidance — the `01-delegate-subagents`
section and the skill's "default to spawning" tips — did not override
that judgement in a cold, single-ask conversation.

### What a fan-out costs, measured

The capability probe and the wide-review probe run the same twenty-four
documents to the same output file on the same profile, one delegating and
one not. Same job, same model:

|                                 | Inline (`probe-fanout-wide-review`) | Four workers (`probe-subagent-capability`) |
| ------------------------------- | ----------------------------------- | ------------------------------------------ |
| Assistant cost                  | $0.349                              | $0.930 (partially metered, so a floor)     |
| Conversation wall-clock         | 92 s                                | 148 s                                      |
| Input tokens through the parent | 1,126                               | 466,346                                    |

Every worker pays for its own context, and the parent pays again to read
the results back. That ratio — 2.7x the spend and 1.6x the latency for
identical output — is what an unnecessary fan-out costs a user, and it is
the number the delegation guidance is trading against.

### Before and after the fix, on the one shape that spawns

The capability probe run against both builds, `vellum-default`, same
fixture and same ask:

|                                 | Pre-fix (`65bf2a2101`)                     | Post-fix (`31688f21a8`) |
| ------------------------------- | ------------------------------------------ | ----------------------- |
| Subagents spawned               | 4 (`researcher`, batched two vendors each) | 0                       |
| Assistant cost                  | $0.930                                     | $0.534                  |
| Conversation wall-clock         | 148 s                                      | 230 s                   |
| Input tokens through the parent | 466,346                                    | 2,166                   |

This is the fix working: a 43% cut in spend on a request that used to
fan out. Two things are worth stating plainly alongside it. The user in
that probe asks for parallel workers **outright**, and the post-fix
build declines — restraint on an unnecessary fan-out, or an explicit
instruction not followed, depending on what the product wants. And the
inline path took 55% longer, so the fan-out was buying real wall-clock
with the money it spent.

On the wide-review case, where neither build spawns, post-fix matches
pre-fix (0 spawns, review 1.00, $0.411 against $0.349, 153 s against
92 s — one sample each, inside run-to-run noise). Nothing regressed.

### What that means for measuring the fix

These cases cannot show a before/after difference on the models tested,
because the "before" already scores 1.00. They are worth keeping as
regression guards — a future prompt or skill change that reintroduces
reflexive fan-out fails them — but the fix's effect has to be looked for
where the behaviour actually lives. Three differences between these runs
and the production conversations that spawn:

1. **Model.** Production's managed balanced tier is gpt-5.6-luna. Both
   models tested here (Sonnet 4.6, GLM 5.2) are ones the managed tier
   does not run for the conversation turn. `vellum-balanced-luna` is the
   profile that would close this gap; it currently fails setup on an
   expired `OPENAI_API_KEY`, and `vellum-v3-latest` fails because its
   pinned `deepseek-v4-flash` is gone from the Fireworks catalog.
2. **Conversation age.** These runs are two or three turns old. In the
   telemetry, spawn-bearing turns sit inside long-running conversations,
   and 20% of them are triggered by a subagent's own completion report —
   a cascade that needs a first spawn to exist.
3. **Invocation shape.** A meaningful share of production spawn turns
   are scheduled or background runs, not live chat.

A faithful reproduction likely needs a multi-phase case (a second and
third related ask in the same conversation) on a Luna-pinned profile.
That is the next thing to try, and it needs a working OpenAI key.

## Run A — pre-fix baseline

Create a parent-repo worktree pinned at the baseline commit (the harness
builds the assistant-under-test from whatever tree
`EVALS_ASSISTANT_SOURCE` points at):

```bash
git -C /path/to/vellum-assistant worktree add ../va-subagent-baseline 65bf2a2101
```

Then run both cases against it:

```bash
EVALS_ASSISTANT_SOURCE=/path/to/va-subagent-baseline bun run src/cli.ts run \
  --profiles vellum-default \
  --filter shipyard-red-check,supplier-quote-verdicts \
  --label subagent-baseline \
  --session-id subagent-baseline
```

There is no `--repeat` flag. Delegation is a judgement call and varies
run to run, so a single run tells you little: run the command three
times, bumping `--session-id`, and read the median.

## Run B — post-fix HEAD

Same command with `EVALS_ASSISTANT_SOURCE` unset (or pointed at a
worktree of current main), and a different label and session id.

## Reading the result

Three metrics carry the signal, and they are meant to be read together:

- **`spawn-restraint`** — the direct measure. 1.00 means the run did the
  job itself. Its metadata carries `spawnCount`, `advisorCount`,
  `workerCount`, the roles and labels, each briefing's first 300
  characters, and which workspace items the briefings named. A
  `perItemSpawnCount` above zero is a fan-out over the fixture's items; a
  non-zero `advisorCount` on either case is the consult mandate firing.
- **`assistant-cost`** and **`runtime-efficiency`** — what the spawns
  cost. Each worker pays for a fresh context, and an advisor consult
  blocks the turn while a stronger model reads it, so a spawning run
  should be visibly dearer and slower than a restrained one.
- **`check-green`** / **`summary-correct`** — whether the answer is right
  at all. Restraint that loses the answer is not the win; a fix that
  removes delegation and breaks the task shows up here.

Every execution's Score tab also carries the neutral tool-usage table, so
`subagent_spawn` and `subagent_read` call counts are visible per run
without reading the event stream. For a whole session:

```bash
bun run src/cli.ts export --session <session-id> --out runs/<name>.jsonl
bun scripts/analyze-tool-usage.ts runs/<name>.jsonl
```

which prints the per-tool tally per execution plus the delegation signal
(spawns while touching at most one file directly).

## Calibrating the baselines

`COST_BASELINE_USD` and `RUNTIME_BASELINE_MS` in each case's
`constants.ts` ship as placeholders. Calibrate them to the observed
median of the POST-fix runs, so that the cost and latency metrics read
1.00 for a restrained run and visibly below 1.00 for a spawning one.
Note in the PR that changes them what session the median came from.

## Regenerating the fixtures

Both fixtures are generated, and the generators are the source of truth:

```bash
bun benchmarks/personal-intelligence/lib/fixtures/shipyard/generate.ts
bun benchmarks/personal-intelligence/lib/fixtures/supplier-quotes/generate.ts
```

Each is idempotent: a diff after running it means the tree and its
committed ground truth have drifted apart. `bun test
src/lib/__tests__/spawn-restraint-fixtures.test.ts` holds that line —
the shipyard check must fail in exactly one package, and every quote must
add up to its committed total.
