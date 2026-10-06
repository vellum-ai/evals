# shipyard

The shop's system, split into 14 small packages under `packages/`.
Each one owns a slice of the shop and carries its own tests.

Everything runs straight from source with `bun` — there is no install
step and no build step.

## Running the nightly check

```
bun run check.ts
```

It runs each package's checks and prints one line per package, then a
count. Any `FAIL` line means that package's checks did not pass.

Each module has its checks beside it as `<module>.checks.ts`. The check
script names them explicitly, so run the script rather than a bare
`bun test`.

## The packages

- `core` — Shared money helpers every other package builds on
- `invoicing` — Turns line items into an invoice total
- `billing` — Charges a customer's card for an invoice
- `catalog` — The products the shop sells and what they cost
- `checkout` — Turns a basket into an order
- `shipping` — What it costs to send an order out
- `inventory` — What is on the shelf and what is spoken for
- `notifications` — The messages the shop sends its customers
- `reporting` — Daily totals for whoever is minding the shop
- `scheduling` — When the van goes out and what is on it
- `auth` — Who is allowed to open the till
- `audit` — The trail of who changed what
- `returns` — Taking something back and paying it out
- `search` — Finding a product by what a shopper typed

## House rules

Money is integer cents everywhere, and `core` owns the arithmetic.
A rate (tax, surcharge) is applied to a total and rounded once, at the
end — never part by part.
