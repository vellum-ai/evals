# Prompt Cache

Verifies that the assistant's prompt cache is used correctly and
near-optimally, and that it behaves the same across providers.

A short deterministic conversation is sent to a freshly hatched
assistant, and cache behavior is scored from the egress jail's recorded
usage: the mitmproxy addon's `egress-usage.ndjson`, which is wire truth.
Cache accounting is exactly the thing an assistant-side bug misreports,
so the assistant is never asked to grade itself.

The turns are trivially small on purpose. What is being measured is the
_prefix_ (system prompt, tool schemas, prior turns), which is identical
from one request to the next. Any request after the first that pays base
input rate for that prefix is a bug in breakpoint placement, not a
property of the conversation.

## Layout

```
benchmarks/prompt-cache/
├── manifest.json                  # displayName + unitDirName + unitNoun
├── README.md                      # this file
├── scenarios/
│   ├── short-chat/SPEC.md         # 4 short no-tool turns
│   └── tool-loop/SPEC.md          # 1 short turn, then a shell tool loop
└── src/
    ├── run.ts                     # `benchmark.run()` entry point
    ├── runner.ts                  # per-scenario hatch → send → score
    ├── scenarios.ts               # the fixed turn text each scenario sends
    ├── cache-metrics.ts           # pure scoring over recorded usage
    └── __tests__/                 # fixture-backed scoring tests
```

`SPEC.md` is documentation for a human reader: scoring is hand-rolled in
`cache-metrics.ts`, not driven by the spec files (same arrangement as
`benchmarks/compaction-thrash/`).

## Running it

`EVALS_VELLUM_SOURCE` must point at the vellum-assistant checkout under
test. The Vellum adapter passes it to `vellum hatch --source`, so it
decides which assistant build the run measures. Pointing it at a branch
worktree and then at `main` is how you get a before/after pair for a
cache fix.

```bash
export PATH="$HOME/.bun/bin:$PATH"
export EVALS_VELLUM_SOURCE=/path/to/vellum-assistant

# OpenAI-pinned arm (needs OPENAI_API_KEY)
bun run src/cli.ts run \
  --profiles vellum-balanced-luna \
  --benchmark prompt-cache \
  --filter short-chat \
  --label "cache-luna-before"

# Fireworks-pinned arm (needs FIREWORKS_API_KEY)
bun run src/cli.ts run \
  --profiles vellum-balanced-glm52 \
  --benchmark prompt-cache \
  --filter short-chat

# Stock Anthropic baseline (needs ANTHROPIC_API_KEY)
bun run src/cli.ts run \
  --profiles vellum-default \
  --benchmark prompt-cache \
  --filter tool-loop
```

Omit `--filter` to run both scenarios. Pass several profiles at once
(`--profiles vellum-default,vellum-balanced-luna`) for a single-session
cross-provider comparison, and add `--workers 2` to run them in parallel.

`EVALS_PROMPT_CACHE_MODEL` pins the model whose requests are scored. By
default the runner picks the model accounting for the most prompt tokens,
which excludes the auxiliary call sites (conversation title, reply
suggestions) that run on a cheaper model.

## Metrics

All four are computed over the main model's requests, ordered by
`recorded_at`, with non-2xx and zero-token records dropped.

| Metric                         | Unit     | Optimal | Meaning                                                                                                   |
| ------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `first-request-write-coverage` | fraction | ~1.0    | Share of the cold request's cacheable prompt that was written to cache. 0 means no breakpoint was placed. Explicit-cache providers only; implicit-cache arms (Fireworks) legitimately score 0. |
| `steady-read-ratio`            | fraction | > 0.8   | Share of prompt tokens served from cache across requests 2..N.                                            |
| `cold-request-count`           | raw      | 0       | Requests after the first that read nothing from cache. Each is a full-prefix rebill.                      |
| `uncached-input-tokens`        | raw      | small   | Base-rate prompt tokens across requests 2..N. Should be roughly the per-turn delta text.                  |

Providers disagree about whether cached tokens are counted inside the
input count, so every record is first normalized to a disjoint
`(direct, read, write)` triple: Anthropic reports the three separately,
while the OpenAI family (OpenAI Responses, Fireworks, OpenRouter) folds
both cached subsets into the inclusive input count. The metrics are
therefore directly comparable across arms.

## Artifacts

Alongside the standard run artifacts, each run writes
`cache-observations.json` with the full per-request table: the token
triple, latency, status, and which explicit markers the request body
actually carried: `cache_control` block count for Anthropic,
`prompt_cache_key` / `prompt_cache_options.mode` /
`prompt_cache_breakpoint` count for OpenAI. Request bodies are capped by
the recorder, so a body that arrives truncated reports `markers: null`
rather than a misleading zero.

That file is what turns a bad score into a diagnosis: zero markers on
request 1 is a marker-placement bug, whereas markers present with no
reads on later requests points at a breakpoint anchored to content that
changes every turn.
