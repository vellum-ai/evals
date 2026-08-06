#!/usr/bin/env bun
// generate.ts — regenerates the ledger mini-project fixtures and prints
// the ground truth for constants.ts. Run from this directory:
//   bun generate.ts
// Never hand-edit project/, expected-fixed/, or the constants it prints.
//
// What it emits:
//   project/src/ledger.ts   — ~3,000-line ledger lib, many similar-looking
//                             per-category functions, ONE planted bug: the
//                             office-supplies filter compares against the
//                             office-services constant.
//   project/report.ts       — tiny entry point; `bun run report.ts` prints
//                             the March office-supplies total (wrong until
//                             the bug is fixed).
//   expected-fixed/ledger.ts — the byte-exact intended fix. Ground truth
//                             for the minimal-diff metric; NOT staged into
//                             the agent's workspace.
//
// The whole project is dependency-free TypeScript runnable with bare
// `bun` — the eval egress jail is fail-closed, so nothing can be
// installed at runtime.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Deterministic PRNG (mulberry32) so fixtures and ground truth are
// reproducible from this file alone.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260806);
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)];
const randInt = (min: number, max: number): number =>
  min + Math.floor(rand() * (max - min + 1));

// 48 categories from a 12x4 product — deliberately similar-looking names
// so `office-supplies` sits alongside `office-services`, the pair the
// planted bug confuses.
const PREFIXES = [
  "office",
  "field",
  "vendor",
  "facilities",
  "marketing",
  "events",
  "fleet",
  "training",
  "lab",
  "studio",
  "warehouse",
  "retail",
];
const SUFFIXES = ["supplies", "services", "equipment", "maintenance"];
const CATEGORIES = PREFIXES.flatMap((prefix) =>
  SUFFIXES.map((suffix) => `${prefix}-${suffix}`),
);

// The bug pair: the filter for BUG_CATEGORY compares against the
// constant for BUG_WRONG_CATEGORY.
const BUG_CATEGORY = "office-supplies";
const BUG_WRONG_CATEGORY = "office-services";

const pascal = (category: string): string =>
  category
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
const constName = (category: string): string =>
  `CATEGORY_${category.replace(/-/g, "_").toUpperCase()}`;

// ---------------------------------------------------------------------------
// Entries: six months of 2025, one line each in the emitted array.
// ---------------------------------------------------------------------------
interface Entry {
  id: string;
  date: string;
  category: string;
  memo: string;
  amountCents: number;
}

const MEMOS = [
  "restock order",
  "quarterly invoice",
  "net-30 payment",
  "purchase order",
  "recurring charge",
  "one-off purchase",
  "contract renewal",
  "expense report",
  "reimbursement",
  "service call",
  "bulk order",
  "emergency replacement",
];

const ENTRY_COUNT = 1400;
const entries: Entry[] = [];
for (let i = 1; i <= ENTRY_COUNT; i += 1) {
  const month = String(randInt(1, 6)).padStart(2, "0");
  const day = String(randInt(1, 28)).padStart(2, "0");
  entries.push({
    id: `T-${String(i).padStart(4, "0")}`,
    date: `2025-${month}-${day}`,
    category: pick(CATEGORIES),
    memo: pick(MEMOS),
    amountCents: randInt(500, 99999),
  });
}

// ---------------------------------------------------------------------------
// Ledger source. `buggy: true` plants the wrong constant in the
// BUG_CATEGORY filter — the single line the fix must change.
// ---------------------------------------------------------------------------
function buildLedger(input: { buggy: boolean }): string {
  const lines: string[] = [];
  lines.push(
    "// ledger.ts — company ledger: entry data and per-category reporting.",
    "// Amounts are integer cents; dates are ISO YYYY-MM-DD.",
    "",
    "export interface LedgerEntry {",
    "  id: string;",
    "  date: string;",
    "  category: string;",
    "  memo: string;",
    "  amountCents: number;",
    "}",
    "",
    "// Category identifiers. Every filter below matches on one of these.",
  );
  for (const category of CATEGORIES) {
    lines.push(`export const ${constName(category)} = "${category}";`);
  }
  lines.push("", "export const LEDGER_ENTRIES: readonly LedgerEntry[] = [");
  for (const entry of entries) {
    lines.push(
      `  { id: "${entry.id}", date: "${entry.date}", category: "${entry.category}", memo: "${entry.memo}", amountCents: ${entry.amountCents} },`,
    );
  }
  lines.push("];");
  for (const category of CATEGORIES) {
    const name = pascal(category);
    const isBugSite = input.buggy && category === BUG_CATEGORY;
    const filterConst = constName(isBugSite ? BUG_WRONG_CATEGORY : category);
    lines.push(
      "",
      `// --- ${category} ---`,
      "",
      `export function filter${name}Entries(`,
      "  entries: readonly LedgerEntry[],",
      "): LedgerEntry[] {",
      `  return entries.filter((entry) => entry.category === ${filterConst});`,
      "}",
      "",
      `export function sum${name}Cents(entries: readonly LedgerEntry[]): number {`,
      `  return filter${name}Entries(entries).reduce(`,
      "    (total, entry) => total + entry.amountCents,",
      "    0,",
      "  );",
      "}",
      "",
      `export function count${name}Entries(`,
      "  entries: readonly LedgerEntry[],",
      "): number {",
      `  return filter${name}Entries(entries).length;`,
      "}",
      "",
      `export function largest${name}AmountCents(`,
      "  entries: readonly LedgerEntry[],",
      "): number {",
      `  return filter${name}Entries(entries).reduce(`,
      "    (largest, entry) => Math.max(largest, entry.amountCents),",
      "    0,",
      "  );",
      "}",
    );
  }
  lines.push(
    "",
    "// --- cross-category helpers ---",
    "",
    "export function entriesInMonth(",
    "  entries: readonly LedgerEntry[],",
    "  monthPrefix: string,",
    "): LedgerEntry[] {",
    "  return entries.filter((entry) => entry.date.startsWith(monthPrefix));",
    "}",
    "",
    "export function totalCents(entries: readonly LedgerEntry[]): number {",
    "  return entries.reduce((total, entry) => total + entry.amountCents, 0);",
    "}",
    "",
    "export function formatCents(cents: number): string {",
    "  const dollars = Math.floor(cents / 100);",
    "  const remainder = String(cents % 100).padStart(2, \"0\");",
    "  const grouped = String(dollars).replace(/\\B(?=(\\d{3})+(?!\\d))/g, \",\");",
    "  return `$${grouped}.${remainder}`;",
    "}",
    "",
    `export function marchOfficeSuppliesTotalCents(): number {`,
    `  return sumOfficeSuppliesCents(entriesInMonth(LEDGER_ENTRIES, "2025-03"));`,
    "}",
    "",
  );
  return lines.join("\n");
}

const buggy = buildLedger({ buggy: true });
const fixed = buildLedger({ buggy: false });

// The intended fix is exactly one line. Locate it by diffing the two.
const buggyLines = buggy.split("\n");
const fixedLines = fixed.split("\n");
if (buggyLines.length !== fixedLines.length) {
  throw new Error("buggy and fixed ledgers must differ only in content");
}
const changedLines: number[] = [];
for (let i = 0; i < buggyLines.length; i += 1) {
  if (buggyLines[i] !== fixedLines[i]) changedLines.push(i + 1);
}
if (changedLines.length !== 1) {
  throw new Error(
    `expected exactly one planted-bug line, found ${changedLines.length}`,
  );
}

const report = [
  'import { formatCents, marchOfficeSuppliesTotalCents } from "./src/ledger";',
  "",
  "console.log(",
  "  `March office-supplies total: ${formatCents(marchOfficeSuppliesTotalCents())}`,",
  ");",
  "",
].join("\n");

// Ground truth, computed from the entry data itself (not by running the
// generated code): correct = March office-supplies; buggy = what the
// miswired filter actually sums, March office-services.
function formatCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${grouped}.${remainder}`;
}
const marchTotal = (category: string): number =>
  entries
    .filter((e) => e.category === category && e.date.startsWith("2025-03"))
    .reduce((total, e) => total + e.amountCents, 0);
const correctCents = marchTotal(BUG_CATEGORY);
const buggyCents = marchTotal(BUG_WRONG_CATEGORY);
const correctOutput = formatCents(correctCents);
const buggyOutput = formatCents(buggyCents);
if (correctCents === buggyCents) {
  throw new Error("planted bug must change the printed total");
}
if (correctOutput.includes(buggyOutput) || buggyOutput.includes(correctOutput)) {
  throw new Error("outputs must not be substrings of each other");
}

mkdirSync(join(import.meta.dir, "project", "src"), { recursive: true });
mkdirSync(join(import.meta.dir, "expected-fixed"), { recursive: true });
writeFileSync(join(import.meta.dir, "project", "src", "ledger.ts"), buggy);
writeFileSync(join(import.meta.dir, "project", "report.ts"), report);
writeFileSync(join(import.meta.dir, "expected-fixed", "ledger.ts"), fixed);

console.log(
  JSON.stringify(
    {
      buggyOutput,
      correctOutput,
      buggyCents,
      correctCents,
      targetFile: "src/ledger.ts",
      expectedChangedLines: changedLines,
      ledgerLineCount: buggyLines.length,
      bugCategory: BUG_CATEGORY,
      bugWrongCategory: BUG_WRONG_CATEGORY,
    },
    null,
    2,
  ),
);
