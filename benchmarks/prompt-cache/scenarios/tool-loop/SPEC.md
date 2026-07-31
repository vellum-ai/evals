---
status: experimental
---

# tool-loop

One short no-tool turn, then a turn that asks the assistant to run a
single harmless shell command (`pwd`) and report the result. The second
turn is therefore not one model request but a loop: a request that emits
the tool call, then a request carrying the tool result back.

In-turn loop requests are the densest cache opportunity in the whole
product. They are separated by milliseconds and differ only by the tool
result appended at the end, so every one of them after the first should
be almost entirely a cache read. When they are not, an agentic turn costs
a multiple of what it should, and the cost scales with the number of tool
calls rather than with the work done.

## Observables

- The second turn produces more than one model request
- Each in-turn loop request reads the prefix rather than rewriting it
- Base-rate prompt tokens after request 1 stay near the size of the tool
  result, not the size of the conversation
- Tool confirmations are auto-approved by the runner, so a stalled turn
  means the assistant never asked to run the command

## Success criteria (scored by metrics)

- `first-request-write-coverage` > 0.9 (the cold request writes the prefix)
- `steady-read-ratio` > 0.8 (loop requests are served from cache)
- `cold-request-count` == 0 (no loop request rebills the whole prefix)
- `uncached-input-tokens` < 3000 across requests 2..N (tool results and
  per-turn deltas only)

Provider scope: `first-request-write-coverage` is meaningful only for
providers that report explicit cache writes (OpenAI GPT-5.6 explicit
mode, Anthropic cache_creation). Implicit-cache providers such as
Fireworks report no write tokens and legitimately score 0 on it; judge
those arms on `steady-read-ratio` and `cold-request-count` alone.
Measured healthy baselines (2026-07-30): GPT-5.6 Luna 99.7% coverage /
99.1% steady reads; GLM 5.2 on Fireworks 99.3% steady reads with zero
cold requests.

## Reading the artifact

`cache-observations.json` in the run directory lists every scored
request with its token split and marker counts. Requests belonging to
the tool loop are adjacent in time and share a model; a cold request in
the middle of that group points at a breakpoint anchored to content the
loop mutates each iteration.
