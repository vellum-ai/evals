#!/usr/bin/env bun
/**
 * Write `quotes/` from `quotes.ts` and print the totals `truth.ts`
 * carries. Run this rather than editing either by hand:
 *
 *   bun benchmarks/personal-intelligence/lib/fixtures/supplier-quotes/generate.ts
 *
 * The script is idempotent: with the definitions unchanged it writes the
 * same bytes, so a diff after running it means the fixture and the
 * committed ground truth have drifted apart.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatUsd, QUOTES, quoteTotalCents } from "./quotes";

const quotesDir = join(import.meta.dir, "quotes");
rmSync(quotesDir, { recursive: true, force: true });
mkdirSync(quotesDir, { recursive: true });

function render(quote: (typeof QUOTES)[number]): string {
  const lines = quote.lines
    .map((line) => {
      const label = `${line.quantity} x ${line.item}`;
      const dots = ".".repeat(Math.max(3, 34 - label.length));
      return `  ${label} ${dots} ${line.each.toFixed(2)} each`;
    })
    .join("\n");
  return `Quote from ${quote.supplier}
Reference: ${quote.reference}
Received: ${quote.received}

Line items
${lines}

Delivery: ${quote.leadDays} working days
Payment terms: ${quote.terms}

Note: ${quote.note}
`;
}

for (const quote of QUOTES) {
  writeFileSync(join(quotesDir, `${quote.slug}.txt`), render(quote), "utf8");
}

console.log(`wrote ${QUOTES.length} quotes under quotes/`);
console.log("");
console.log("Ground truth (copy into truth.ts):");
const totals = QUOTES.map((quote) => ({
  quote,
  cents: quoteTotalCents(quote),
}));
for (const { quote, cents } of totals) {
  console.log(
    `  ${quote.supplier.padEnd(22)} ${formatUsd(cents).padStart(9)}  ${String(quote.leadDays).padStart(2)} days`,
  );
}
const cheapest = totals.reduce((best, row) =>
  row.cents < best.cents ? row : best,
);
console.log("");
console.log(
  `  cheapest: ${cheapest.quote.supplier} at ${formatUsd(cheapest.cents)}`,
);
