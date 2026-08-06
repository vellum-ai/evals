---
status: experimental
---

# deep-file-fact-lookup

## Your role

You run purchasing for a small hardware retailer. Engineering keeps the
catalog pricing in a generated file a sync job rewrites nightly; you have
never opened it and would not know what to look for if you did. Finance
wants a ballpark for a one-of-everything sample order before Friday.

You are not a programmer. You never mention tools, paging, limits, or
file sizes — you asked a capable assistant for a number and you expect a
number.

## What this test measures

Whether the assistant works a long file properly instead of answering
from the first window it saw. The pricing file is far longer than a
single default read returns, and the part a shallow read shows is a
clearly-labelled superseded snapshot of the same SKUs at older prices —
with a comment saying the current table is further down. An assistant
that never pages past the truncation notice computes a specific,
detectably-wrong total from the superseded snapshot; the right answer
only exists deeper in the file. Also measured: whether paging resumes
from the offset the truncation notice supplies (rather than re-reading
from the top), and how much file content the run pulled inline to get
there.

## What you ask

Open the conversation with this message, verbatim:

> What would it cost to order one of every SKU in our active catalog?
> The pricing file is catalog/price-table.ts.

## How you respond

- If it asks which table, snapshot, or effective date to use, say
  whatever the current catalog says.
- If it asks any other clarifying question about the file's contents,
  say you've never looked inside it — whatever the current catalog says
  is what you want.
- If it asks permission to read files or run anything, approve it.
- If it offers a per-SKU breakdown, say the total is all you need.
- Never mention tools, paging, limits, or file sizes.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant states a total for the order —
or once it explicitly gives up.

## Fixtures

Staged by `setup.ts`: a small catalog module whose centerpiece is
`catalog/price-table.ts`, a generated 6,000-line pricing file. Generated
by `assets/generate.ts`, which also prints the ground truth — regenerate
with that script rather than editing fixtures or `constants.ts` by hand.

The layout is the trap. `DEPRECATED_PRICE_TABLE_2025` (150 SKUs, sum
$18,116) sits at lines ~1390–1544, fully inside the default 2000-line
read window, under a comment saying it is superseded and the current
table is further down. `CURRENT_PRICE_TABLE` (the same 150 SKU ids at
different prices, sum $20,270) opens at line 5,200. A truncation-blind
agent that sums what the first window shows lands exactly on $18,116; a
careful non-paging agent can know it is missing data but cannot answer
without paging or searching.

## Success criteria (scored by metrics)

- The assistant's answer states the correct total, $20,270 — not the
  superseded table's $18,116, which is the arithmetic signature of never
  paging past the truncation notice.
- When a default-window read of `catalog/price-table.ts` was truncated
  short of the file's end, later reads advanced coverage past the
  truncated window (resuming at, before, or past the notice's offset)
  instead of re-reading from the top or abandoning the file. Not
  applicable when no default-window read was truncated — explicit
  `offset`/`limit` slices (e.g. grep-guided) and a notice covering only
  the trailing phantom line are winning strategies, recorded in
  metadata rather than scored.
- Read economy is recorded (total inline result chars, reads per file,
  default-limit reads, spooled reads) as evidence for whether the
  2000-line default read window earns its size on dense files.
- Assistant cost is scored against a placeholder $0.10 baseline.
