# Runbook: coding-cost baseline (pre-fix main vs post-fix HEAD vs Hermes)

Three eval runs that answer, with the egress-jail cost authority as the
source of truth:

1. Did the recent assistant cost/latency fixes actually move the needle?
2. Is Vellum really "much more expensive than Hermes" on coding use-cases?
3. Are the flagged follow-ups warranted (drop the 2000-line `file_read`
   default? discourage `file_write` rewrites)?

All commands run from an `evals/` checkout with dependencies installed
(`bun install`, `.env` from `.env.example`). `evals <cmd>` below means
`bun run src/cli.ts <cmd>`.

## Context

**The four coding cases.** All are `status: experimental`, so an
unfiltered `evals run` skips them — `--filter` is mandatory:

| Case id                  | What it measures                                                         |
| ------------------------ | ------------------------------------------------------------------------ |
| `deep-file-fact-lookup`  | Truncation-notice paging in a 6,000-line file; read economy              |
| `surgical-bugfix-ledger` | `code_search`-guided fix; patch-style `file_edit` vs full-file rewrite   |
| `cross-file-survey`      | Slice economy across ~40 config files; wall-clock under many-search load |
| `oversized-log-triage`   | Spooled-result recovery (`.tool-results/` deref) on a ~4 MB log          |

**The assistant fixes under test** (parent repo, oldest → newest):

- `89d919be5b` — async `code_search` walk (blocking child_process calls
  off the event loop)
- `a417619ee0` — subagent consolidation to researcher/builder/advisor
- `1f94eb7226` — 2000-line `file_read` default + truncation notice, and
  narrowed spool exemption (only `.tool-results/` reads stay inline)

**Baseline commit: `3c87207309`** — the direct parent of `89d919be5b`,
the first fix. Building the assistant from this commit gives you the
last pre-fix state of main with nothing else missing.

## Run A — pre-fix baseline

Create a parent-repo worktree pinned at the baseline commit (the evals
harness builds the assistant-under-test from whatever tree
`EVALS_ASSISTANT_SOURCE` points at):

```bash
git -C /path/to/vellum-assistant worktree add ../va-baseline 3c87207309
```

Then run the four cases against it:

```bash
EVALS_ASSISTANT_SOURCE=/path/to/va-baseline evals run \
  --profiles vellum-default \
  --filter deep-file-fact-lookup,surgical-bugfix-ledger,cross-file-survey,oversized-log-triage \
  --label baseline-pre-fixes \
  --session-id baseline-pre-fixes
```

There is no `--repeat` flag — for variance, run the command three times
(three sessions), bumping `--session-id` to `baseline-pre-fixes-2` and
`baseline-pre-fixes-3`. (`--session-id` is optional; without it a
`session-<timestamp>-baseline-pre-fixes` id is generated, which you'd
then have to look up in the report server before exporting.)

Notes:

- **Fallback for older evals builds without `EVALS_ASSISTANT_SOURCE`**:
  check out the baseline commit in place —
  `git -C /path/to/vellum-assistant checkout 3c87207309`. The parent
  repo gitignores `evals/`, so the checkout leaves your evals checkout
  untouched; check main back out when done.
- **`EVALS_VELLUM_CLI`** can additionally pin the `vellum` CLI binary
  (instead of whatever is on `PATH`). For this baseline it is
  optional: none of the three fix commits touch `cli/` (they change
  `assistant/` plus docs/client ancillary), so CLI drift is immaterial
  here.

## Run B — post-fix HEAD

Same command, no overrides — the assistant builds from the parent repo
at its current HEAD:

```bash
evals run \
  --profiles vellum-default \
  --filter deep-file-fact-lookup,surgical-bugfix-ledger,cross-file-survey,oversized-log-triage \
  --label post-fixes \
  --session-id post-fixes
```

Repeat three times as above (`post-fixes-2`, `post-fixes-3`).

## Run C — Hermes head-to-head

Run both profiles in **one session**, so the report's native
per-profile comparison (per-profile score/cost aggregates on the
session page) applies directly:

```bash
evals run \
  --profiles vellum-default,hermes-default \
  --filter deep-file-fact-lookup,surgical-bugfix-ledger,cross-file-survey,oversized-log-triage \
  --label hermes-coding-baseline \
  --session-id hermes-coding-baseline \
  --serve
```

`--serve` starts the local report server after the run and opens this
session's page. Hermes needs a provider API key in your environment
(the adapter forwards `OPENROUTER_API_KEY` and the other
`*_API_KEY` vars into the container).

## Export + compare

Export each session as flat JSONL (`runs/` is gitignored):

```bash
evals export --session baseline-pre-fixes --out runs/baseline-pre-fixes.jsonl
evals export --session post-fixes --out runs/post-fixes.jsonl
evals export --session hermes-coding-baseline --out runs/hermes-coding-baseline.jsonl
```

**Fix efficacy** — pre-fix vs post-fix, per test:

```bash
evals compare runs/baseline-pre-fixes.jsonl runs/post-fixes.jsonl
```

**Cost ratio vs Hermes** — the same session's file on both sides with
`--by profile` compares the profiles within it:

```bash
evals compare runs/hermes-coding-baseline.jsonl runs/hermes-coding-baseline.jsonl --by profile
```

Both accept `--format table|md|json` (default `table`).

## Decision criteria

What the numbers decide, mapped to the original Slack-thread questions:

- **(a) "We are much more expensive than Hermes on coding use-cases."**
  The headline vellum/hermes cost ratio per case from the `--by profile`
  compare above (and the per-profile cost aggregates on the Run C
  session page). This is jail-recorded assistant traffic priced by the
  harness — not self-reported usage — so the ratio is trustworthy.
- **(b) "Is the 2000-line `file_read` default too generous?"** The
  `read-economy` metric's metadata (`deep-file-fact-lookup` and
  `oversized-log-triage`, one shared schema — see
  `src/lib/common-metrics/read-economy.ts`): compare
  `defaultLimitReadCount` against `spooledReadCount` and the truncation
  counts from `truncation-paging`. If
  most default-limit reads get spooled anyway, the 2000-line default is
  doing round-trip work for nothing (a big inline read that immediately
  becomes a stub plus a deref) and should drop — candidate values to
  test next: 500 and 1000.
- **(c) "Does the model rewrite whole files instead of patching?"** The
  `patch-not-rewrite` score on `surgical-bugfix-ledger` (with
  `minimal-diff` as the churn signal). Low scores post-fix mean the
  bash-tool migration / `file_write`-description follow-ups are
  warranted.
- **(d) "Did the three fixes move the needle?"** The pre/post deltas on
  `assistant-cost-usd` (all four cases) and `runtime-efficiency`
  (`cross-file-survey` — the indirect signal for the async
  `code_search` walk) from the Run A vs Run B compare.

## Calibration step (after the first Run B)

The cost/runtime baselines in each case's `constants.ts` are
placeholders. After the first post-fix session, update them to the
observed post-fix medians in a small follow-up commit:

- `COST_BASELINE_USD` in all four cases'
  `benchmarks/personal-intelligence/tests/<id>/constants.ts`
- `RUNTIME_BASELINE_MS` in
  `benchmarks/personal-intelligence/tests/cross-file-survey/constants.ts`

## Caveats

- **Baseline runs are local-only.** The eval-pod / `--launcher` path
  ignores `EVALS_ASSISTANT_SOURCE` and falls back to published images
  (see `docker/eval-pod/Dockerfile`), so Runs A–C must run on a
  laptop/sandbox, not via `--launcher`.
- **Simulator + judge traffic is harness-owned** and priced separately
  from assistant cost, so the vellum-vs-hermes cost comparison is
  apples-to-apples assistant spend.
- **Hermes scores container-dependent metrics as `applicable: false` by
  design** (`bug-fixed`, `minimal-diff` — anything that `docker exec`s
  into the Vellum assistant container). The cross-species axes are the
  species-agnostic ones: transcript correctness, jail-recorded
  cost/tokens, and runtime.
