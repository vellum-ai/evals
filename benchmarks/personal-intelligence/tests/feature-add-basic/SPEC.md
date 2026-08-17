---
status: experimental
---

# feature-add-basic

## Your role

You keep track of your personal spending in a little command-line tool a
friend set up for you. You are comfortable typing the handful of commands
you know, you check a month whenever you wonder where the money went, and
you have never once looked at the code behind any of it.

You never mention files, functions, editing styles, or tools. You know
the commands you type and the numbers they print back, and that is the
whole of what you know.

## What this test measures

Whether the assistant can load an unfamiliar little project into context
and land a small, pattern-following feature: the year report is the month
report with a wider filter, so a good run reads what already exists and
composes it rather than inventing a second way to do the same thing.

The feature is easy. What the case is really for is watching how the
assistant gets there: which tools it reaches for, how much of the project
it pulls inline, and what the whole thing costs. Observability of that
strategy matters here as much as pass or fail, so the case is run
alongside the harness cost and tool reporting.

## What you ask

Open the conversation with this message, verbatim:

> I keep my spending in a little command-line tracker. From the `tracker`
> folder I run `bun run cli.ts report month 2025-03` when I want one
> month, and now I want a whole-year view too. Can you make
> `bun run cli.ts report year 2025` work, printing what the year came to?

## How you respond

- If the assistant asks how the data should be stored, how the code
  should be arranged, or how the report should be laid out, say however
  it works now is fine, you just want the year view.
- If it asks which year matters, say 2025 is the one you want to check,
  but any year you type should work.
- If it asks what the report should show, say the year's total, the same
  way the month report shows a month's total.
- If it asks permission to read or change the project, or to run
  anything, approve it.
- If it says it is done without telling you what to type, ask how you run
  it.
- Never suggest a file, a function, a cause, or a way of working.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant says the year view is ready and
says how to run it, or once it explicitly gives up.

## Fixtures

Staged by `setup.ts` under `tracker/`: the shared expense-tracker project
from `benchmarks/personal-intelligence/lib/fixtures/expense-tracker/project`,
a small Bun CLI with four commands (`add`, `list`, `report month`,
`report total`), its own unit tests, and about two dozen seeded entries
running from December 2024 through April 2025.

`expected/` next to that project holds the committed stdout of the
unmodified commands and `truth.ts` holds the totals. Both are produced by
`regen-expected.ts`, which prints the same figures. Regenerate with that
script rather than editing fixtures or `constants.ts` by hand.

## Success criteria (scored by metrics)

- `bun run cli.ts report year 2025`, run in the still-live workspace
  after the conversation, prints the year total $614.49
  (`feature-works`). A usage error or a non-zero exit means the feature
  never landed; a different total means it landed wrong.
- The four commands and tests that already worked still work: `list`,
  `report month 2025-03`, and `report total` print exactly what the
  committed fixture prints, and the project's own `bun test src` passes
  (`nothing-broken`, scored as the fraction of those four checks).
- Assistant spend lands near the case's cost baseline (`assistant-cost`).
