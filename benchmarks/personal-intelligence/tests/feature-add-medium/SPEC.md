---
status: experimental
---

# feature-add-medium

## Your role

You keep track of your personal spending in a little command-line tool a
friend set up for you. You add an expense whenever you spend something,
you check a month whenever you wonder where the money went, and you have
never once looked at the code behind any of it.

You never mention files, functions, editing styles, or tools. You know
the commands you type and the numbers they print back, and that is the
whole of what you know.

## What this test measures

Whether the assistant can land a feature that cuts across a whole small
project instead of sitting in one corner of it. Categories touch the
shape of the stored data, the command that records an expense, the
listing, and every report, and the entries already saved carry no
category at all, so the change has to stay backward compatible with data
the user cannot afford to lose.

The feature is small in lines and wide in reach. As with the other coding
cases, how the assistant gets there is the point: which tools it reaches
for, how much of the project it pulls inline, and what the whole thing
costs, so the case is run alongside the harness cost and tool reporting.

## What you ask

Open the conversation with this message, verbatim:

> I keep my spending in a little command-line tracker. From the `tracker`
> folder I add things with
> `bun run cli.ts add 2025-03-18 42.10 "farmers market"` and read them
> back with `list`, `report month 2025-03` and `report total`. I want
> categories now: I should be able to type
> `bun run cli.ts add 2025-05-02 18.25 "coffee beans" food` to file that
> under food, see each expense's category in the list, and narrow any
> report to one category by putting it on the end, like
> `bun run cli.ts report month 2025-05 food` or
> `bun run cli.ts report total food`. Everything I have already put in has
> no category and has to keep working exactly like it does today.

## How you respond

- If the assistant asks what should happen to everything you have already
  saved, say it all has to keep working exactly like today.
- If it asks how the data should be stored, how the code should be
  arranged, or how the list should be laid out, say however it works now
  is fine, you just want categories.
- If it asks which categories you use, say food and fun to start with,
  and you want to be able to type any word you like.
- If it asks whether a category is required, say no, you will forget half
  the time and that has to be fine.
- If it asks permission to read or change the project, or to run
  anything, approve it.
- If it says it is done without telling you what to type, ask how you run
  it.
- Never suggest a file, a function, a cause, or a way of working.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant says categories are ready and
says how to use them, or once it explicitly gives up.

## Fixtures

Staged by `setup.ts` under `tracker/`: the shared expense-tracker project
from `benchmarks/personal-intelligence/lib/fixtures/expense-tracker/project`,
a small Bun CLI with four commands (`add`, `list`, `report month`,
`report total`), its own unit tests, and about two dozen seeded entries
running from December 2024 through April 2025. No entry carries a
category, which is exactly what the change has to survive.

`expected/` next to that project holds the committed stdout of the
unmodified commands and `truth.ts` holds the totals. Both are produced by
`regen-expected.ts`, which prints the same figures. Regenerate with that
script rather than editing fixtures or `constants.ts` by hand.

## Success criteria (scored by metrics)

- Categories work end to end in the still-live workspace after the
  conversation (`feature-works`, scored as the fraction of five checks,
  run in a copy of the whole project): a categorized expense is accepted,
  a category-narrowed month report and a category-narrowed total each
  count only that category, an old uncategorized month still totals
  $157.42, and the listing shows the category.
- Nothing the user already had is lost (`nothing-broken`, scored as the
  fraction of four checks): `report month 2025-03` still totals $157.42,
  `report total` still totals $717.09, `list` still runs and prints
  something, and the project's own `bun test src` passes.
- Those totals are read from the spending the user actually keeps, so
  they double as a "the run left that data alone" gate: a probe or test
  expense written into the stored data and never removed shifts them and
  fails. The category probes run in a copy of the project for that
  reason, and `feature-works` puts the stored data back — and stops
  believing its own probes — if the copy leaks into it anyway.
- Assistant spend lands near the case's cost baseline (`assistant-cost`).
