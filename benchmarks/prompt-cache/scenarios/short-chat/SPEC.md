---
status: experimental
---

# short-chat

Four short user turns in one conversation, none of which should need a
tool. Each turn adds only a handful of tokens, so the prompt is dominated
by a prefix that never changes: system prompt, tool schemas, workspace
context, and the prior turns. A correct prompt-cache implementation
writes that prefix once on the cold request and reads it back on every
request after.

This is the cheapest possible probe for cache placement bugs. When a
provider adapter writes no breakpoint, or writes one behind content that
changes every turn, the prefix is re-billed at the base input rate on
every turn and the failure shows up here without any long-context setup.

## Observables

- Request 1 writes the whole cacheable prefix rather than paying for it
  at the base input rate
- Requests 2..N read the prefix from cache instead of rebuilding it
- The only base-rate prompt tokens after request 1 are the new user text
- No request after the first is fully cold

## Success criteria (scored by metrics)

- `first-request-write-coverage` > 0.9 (the cold request writes the prefix)
- `steady-read-ratio` > 0.8 (later requests are served from cache)
- `cold-request-count` == 0 (no full-prefix rebills)
- `uncached-input-tokens` < 2000 across requests 2..N (only per-turn deltas)

## Reading the artifact

`cache-observations.json` in the run directory carries the per-request
table, including which explicit markers each request body actually
carried (`cache_control` blocks for Anthropic, `prompt_cache_key` /
`prompt_cache_options.mode` / `prompt_cache_breakpoint` counts for
OpenAI). A run that scores 0 on `first-request-write-coverage` with zero
markers on request 1 is a marker-placement bug, not a provider-side cache
miss.
