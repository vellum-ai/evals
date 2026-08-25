---
status: experimental
---

# table-cell-lookup

## Your role

You are simulating a user who saved a screenshot of a revenue table and
wants three specific readings out of it, without opening it themselves.

## What you ask

Open the conversation with this message, verbatim:

> I saved a screenshot of our revenue table in your workspace as
> table.png. What is South's Q2 figure, what is West's Q3 figure, and
> which region has the highest Q3?

## How you respond

- If the assistant asks which file, say it is `table.png` in its
  workspace.
- If it asks whether you want the exact printed figures, say yes, exactly
  as printed.
- If it answers only part of the question, ask for the missing part in
  one short sentence.
- Never state a figure or a region yourself, even if you know them. Never
  hint at the answer and never confirm or correct a figure it gives.
- Keep every message under three sentences.

## End condition

End the conversation as soon as the assistant has given both figures and
named a region, or explicitly says it cannot read the table.

## Fixtures

`table.png` is staged into the agent's workspace before the conversation
starts by the test's `setup.ts`. It shows a five-row by four-column
table, regions down the side and Q1 to Q4 across the top, every cell
printed to two decimals in plain dollars with no thousands multiplier, so
a cell's value is exactly the number in it.

Two of the three asks are the cells a careless read gets wrong. South Q2
is the table's only negative figure (**-4700.00**), which a run that
drops the minus sign reports as a positive. West Q3 is the only
non-integer (**19950.50**), which a run that rounds reports as 19950 or 19951. The third ask, the highest Q3, is **East** at 58800.00 and is
unique, so there is no tie to argue about.

Ground truth lives in `constants.ts`, which re-exports the definitions
`benchmarks/personal-intelligence/lib/fixtures/image-extraction/generate.ts`
draws the image from, so the picture and the expected answers cannot
drift apart.

## Success criteria (scored by metrics)

- The assistant reports both asked cells exactly as printed, minus sign
  and decimal included.
- The assistant names the region with the highest Q3.
