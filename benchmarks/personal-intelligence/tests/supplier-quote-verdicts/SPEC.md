---
status: experimental
---

# supplier-quote-verdicts

## Your role

You buy the stock for a small chandlery. You asked eight suppliers to
quote for the same three things, their replies came back as eight little
files, and now you have to pick one. You are comfortable with a
spreadsheet and you are perfectly capable of adding this up yourself —
you just have a shop to open.

You never mention subagents, delegation, parallelism, or tooling, and you
would not know what those words meant in this context.

## What this test measures

Whether the assistant's delegation decision tracks the size of the work
rather than the number of things.

Eight independent items is the shape production traces show an assistant
fanning out over, one worker per item. Here each item is a twenty-line
text file and three multiplications. The parts are genuinely independent
and individually trivial, which is precisely the case where a fan-out
cannot pay for itself: briefing a worker about a file costs more than
reading the file.

So this is the restraint half of the delegation judgement, on the axis
that catches reflexive fan-out — the companion to the cases that check a
wide job gets split up. Getting the arithmetic right is the easy part.
Doing it without hiring eight people is the measurement.

## What you ask

Open the conversation with this message, verbatim:

> I've got eight supplier quotes sitting in the `quotes` folder, all for
> the same three items. Can you work out what each one comes to and how
> long each says it'll take, and put it in `quotes-summary.md` — one line
> per supplier, and tell me which is cheapest.

## How you respond

- If the assistant asks whether shipping or tax should be included, say
  just add up what is on the quote.
- If it asks whether the cheapest or the fastest matters more, say you
  want to see both and you will decide.
- If it asks permission to read the quotes or write the file, approve it.
- If it gives you the answer in chat without writing the file, ask for
  the file.
- If it tells you it is splitting the work up or running things in
  parallel, say that is fine and you do not need the details.
- Never suggest a supplier, a file, or a way of working.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant says the summary file is written,
or once it explicitly gives up.

## Fixtures

Staged by `setup.ts` under `quotes/`: the eight quotes from the shared
supplier-quotes fixture in
`benchmarks/personal-intelligence/lib/fixtures/supplier-quotes/quotes`,
one plain-text file per supplier — the same three line items at different
unit prices, with a delivery time and payment terms. The totals sit
within ten dollars of each other, so the answer has to be worked out
rather than eyeballed.

`quotes.ts` (the definitions), `generate.ts` (the writer) and `truth.ts`
(the totals) next to the quotes are metric ground truth and are NOT
staged. Regenerate with the script rather than editing the quotes or
`constants.ts` by hand.

## Success criteria (scored by metrics)

- `quotes-summary.md` exists in the workspace and states every supplier
  with its correct total, and names Kestrel Marine Parts ($438.75) as the
  cheapest (`summary-correct`, scored as the fraction of nine checks).
  Matching ignores formatting and phrasing; what must be right is the
  arithmetic.
- No subagents were spawned (`spawn-restraint`). Each spawn past zero
  costs a quarter of the score, and the metric records which suppliers
  each briefing named, so a worker-per-quote fan-out is visible as what
  it is.
- Assistant spend lands near the case's cost baseline (`assistant-cost`).
