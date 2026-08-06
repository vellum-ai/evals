#!/usr/bin/env bun
// generate.ts — regenerates the deep-file-fact-lookup workspace fixtures
// and prints the ground truth for constants.ts. Run from this directory:
//   bun generate.ts
// Never hand-edit assets/workspace/ or the constants it prints.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { mulberry32 } from "../../../lib/mulberry32";

// Same seed, same fixtures, every run.
const rand = mulberry32(0x5eed);

const SKU_COUNT = 150;
const skus = Array.from(
  { length: SKU_COUNT },
  (_, i) => `SKU-${String(i + 1).padStart(4, "0")}`,
);

// Whole-dollar unit prices. THE TRAP: the deprecated table shares every
// SKU id with the current one but disagrees on the prices, so each table
// produces its own specific total. An agent that reads the file's first
// 2000-line window, sums what it saw, and never pages past the
// truncation notice lands exactly on the deprecated total.
const deprecatedPrices = skus.map(() => 40 + Math.floor(rand() * 160));
const currentPrices = skus.map(() => 45 + Math.floor(rand() * 180));

const deprecatedTotal = deprecatedPrices.reduce((a, b) => a + b, 0);
const correctTotal = currentPrices.reduce((a, b) => a + b, 0);
if (deprecatedTotal === correctTotal) {
  throw new Error("trap totals collide — pick a different seed");
}

// ---------------------------------------------------------------------
// Filler: a plausible auto-appended price-adjustment audit log. Comment
// lines, so padding to an exact line number is trivial and no log line
// can be mistaken for a price basis.
// ---------------------------------------------------------------------
const REASONS = [
  "supplier cost adjustment",
  "fx adjustment",
  "freight surcharge",
  "volume-break retier",
  "promo end",
  "rounding policy",
];
const LOG_EPOCH_MS = Date.UTC(2023, 0, 6);
let logTicks = 0;
function changelogLine(): string {
  logTicks += 1 + Math.floor(rand() * 2);
  const date = new Date(LOG_EPOCH_MS + logTicks * 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sku = skus[Math.floor(rand() * SKU_COUNT)];
  const oldPrice = 40 + Math.floor(rand() * 180);
  const delta = 1 + Math.floor(rand() * 9);
  const newPrice = rand() < 0.5 ? oldPrice - delta : oldPrice + delta;
  const reason = REASONS[Math.floor(rand() * REASONS.length)];
  return `// ${date}  ${sku}  ${oldPrice} -> ${newPrice}  (${reason})`;
}

// ---------------------------------------------------------------------
// Assemble catalog/price-table.ts line by line. 1-based positions:
//   ~1390  "deprecated — see current table below" header comment
//   ~1394  DEPRECATED_PRICE_TABLE_2025 opens (fully inside the default
//          2000-line read window)
//    5200  CURRENT_PRICE_TABLE opens (far past the window)
//    6000  last line
// ---------------------------------------------------------------------
const lines: string[] = [];
/** Pad with audit-log lines so the NEXT push lands at `line` (1-based). */
function padTo(line: number): void {
  while (lines.length < line - 1) lines.push(changelogLine());
}
function table(name: string, prices: number[]): string[] {
  return [
    `export const ${name}: PriceTable = {`,
    ...skus.map((sku, i) => `  "${sku}": ${prices[i]},`),
    `};`,
  ];
}

lines.push(
  "/**",
  " * AUTO-GENERATED — catalog price table. Do not edit by hand; the",
  " * pricing sync job rewrites this file nightly.",
  " *",
  " * Layout, oldest first: the price-adjustment audit log, superseded",
  " * pricing snapshots retained in-file for audit, and finally the",
  " * current table for the active catalog.",
  " */",
  "",
  "export type PriceTable = Record<string, number>;",
  "",
  "// ---- price adjustment log (auto-appended, oldest first) ----",
);

padTo(1389);
lines.push(
  "",
  "// DEPRECATED 2025 pricing — superseded. Do not quote these numbers:",
  "// the current table is much further down this file (see",
  "// CURRENT_PRICE_TABLE near the end).",
  ...table("DEPRECATED_PRICE_TABLE_2025", deprecatedPrices),
);
const deprecatedHeaderLine = 1390;
const deprecatedTableClosesAtLine = lines.length;

lines.push("", "// ---- price adjustment log (continued) ----");
padTo(5196);
lines.push(
  "",
  "// CURRENT pricing — effective 2026-07-01. This is the active catalog;",
  "// every SKU below is orderable today. Supersedes",
  "// DEPRECATED_PRICE_TABLE_2025.",
  ...table("CURRENT_PRICE_TABLE", currentPrices),
);
const currentTableStartsAtLine = 5200;

lines.push(
  "",
  "/** Unit price of `sku` in the active catalog, in whole USD. */",
  "export function currentPriceFor(sku: string): number | undefined {",
  "  return CURRENT_PRICE_TABLE[sku];",
  "}",
  "",
  "// ---- price adjustment log (continued) ----",
);
padTo(6001);
const bigFileTotalLines = lines.length;

// Sanity: the trap only works if the layout landed where the SPEC says.
if (!lines[deprecatedHeaderLine - 1].startsWith("// DEPRECATED 2025")) {
  throw new Error("deprecated header comment drifted off line 1390");
}
if (deprecatedTableClosesAtLine >= 2000) {
  throw new Error("deprecated table leaked past the default read window");
}
if (
  !lines[currentTableStartsAtLine - 1].startsWith(
    "export const CURRENT_PRICE_TABLE",
  )
) {
  throw new Error("CURRENT_PRICE_TABLE drifted off line 5200");
}
if (bigFileTotalLines !== 6000) {
  throw new Error(`expected exactly 6000 lines, got ${bigFileTotalLines}`);
}

// ---------------------------------------------------------------------
// Write the workspace.
// ---------------------------------------------------------------------
const workspaceDir = join(import.meta.dir, "workspace");
function write(relPath: string, content: string): void {
  const abs = join(workspaceDir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

write("catalog/price-table.ts", lines.join("\n") + "\n");
write(
  "catalog/index.ts",
  [
    "// AUTO-GENERATED barrel for the catalog module. Regenerated together",
    "// with price-table.ts by the pricing sync job.",
    'export { CURRENT_PRICE_TABLE, currentPriceFor } from "./price-table";',
    'export type { PriceTable } from "./price-table";',
    "",
  ].join("\n"),
);
write(
  "catalog/README.md",
  [
    "# catalog",
    "",
    "`price-table.ts` is written nightly by the pricing sync job. It keeps",
    "the price-adjustment audit log and superseded snapshots in-file",
    "(compliance wants one auditable artifact), so the file is long.",
    "",
    "Do not edit by hand — changes are overwritten on the next sync.",
    "",
  ].join("\n"),
);

console.log(
  JSON.stringify(
    {
      bigFilePath: "catalog/price-table.ts",
      bigFileTotalLines,
      correctTotal,
      deprecatedTableTotal: deprecatedTotal,
      deprecatedHeaderLine,
      deprecatedTableClosesAtLine,
      currentTableStartsAtLine,
    },
    null,
    2,
  ),
);
