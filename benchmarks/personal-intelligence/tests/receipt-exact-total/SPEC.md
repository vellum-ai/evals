---
status: experimental
---

# receipt-exact-total

## Your role

You are simulating a user who photographed a grocery receipt, saved it in
the assistant's workspace, and wants two facts off it: what it came to,
and how many things are on it.

## What you ask

Open the conversation with this message, verbatim:

> I saved a photo of my grocery receipt in your workspace as receipt.png.
> What is the exact total printed on it, and how many line items are
> listed?

## How you respond

- If the assistant asks which file, say it is `receipt.png` in its
  workspace.
- If it asks what counts as a line item, say the printed product rows,
  not the subtotal or tax lines.
- If it offers the subtotal instead of the total, say you want the total
  printed at the bottom. Do not say what that total is.
- Never state any amount or count yourself, even if you know them. Never
  hint at the answer and never correct its arithmetic.
- Keep every message under three sentences.

## End condition

End the conversation as soon as the assistant states a total dollar
amount and a line-item count, or explicitly says it cannot read the
receipt.

## Fixtures

`receipt.png` is staged into the agent's workspace before the
conversation starts by the test's `setup.ts`. It is a printed store
receipt: eight product rows with a name, a quantity, a unit price and a
line amount, then SUBTOTAL, TAX and TOTAL.

The receipt is arithmetically consistent, so a run that reads every row
can check itself: the eight line amounts sum to the subtotal ($138.31),
and subtotal plus tax ($10.03) is the printed total (**$148.34**). Two
traps sit next to the answer: the subtotal is the number a run that
stops one line early reports, and the quantity column sums to 15, which
is what a run that adds quantities instead of counting rows reports
instead of **8**.

Ground truth lives in `constants.ts`, which re-exports the definitions
`benchmarks/personal-intelligence/lib/fixtures/image-extraction/generate.ts`
draws the image from, so the picture and the expected answers cannot
drift apart.

## Success criteria (scored by metrics)

- The assistant reports the printed TOTAL exactly, to the cent.
- The assistant reports eight line items.
