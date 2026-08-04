#!/usr/bin/env bun
// generate.ts — regenerates the invoice fixtures and prints the ground
// truth for constants.ts. Run from this directory:
//   bun generate.ts
// Never hand-edit invoices/ or the constants it prints.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RENEWAL = "2026-03-01"; // contract renewal; earlier work is out of scope
const EXCLUDED = "Halberd Design"; // on a separate retainer

// vendor -> agreed EUR/hour by role
const RATES: Record<string, Record<string, number>> = {
  "Ostrom Analytics": { analyst: 95, "senior analyst": 130 },
  "Fen & Marlow": { designer: 88, "senior designer": 121 },
  "Halberd Design": { designer: 90, "senior designer": 125 },
  "Quillon Media": { editor: 72, "senior editor": 99 },
  "Bracken Labs": { engineer: 140, "senior engineer": 185 },
  "Alder Copy": { writer: 65, "senior writer": 90 },
  "Verrine Studio": { designer: 84, "senior designer": 118 },
  "Thistlewood Ops": { analyst: 92, "senior analyst": 126 },
  "Corvid Research": { analyst: 98, "senior analyst": 134 },
  "Pellman & Roe": { engineer: 132, "senior engineer": 178 },
  "Saltmarsh Audio": { editor: 70, "senior editor": 96 },
  "Wrenfield Legal": { analyst: 150, "senior analyst": 210 },
};

// [vendor, date, role, hours, chargedRate]
const LINES: Array<[string, string, string, number, number]> = [
  ["Ostrom Analytics", "2026-02-11", "analyst", 12, 95],
  ["Ostrom Analytics", "2026-03-14", "analyst", 18, 95],
  ["Ostrom Analytics", "2026-03-28", "senior analyst", 9, 130],
  ["Fen & Marlow", "2026-03-05", "designer", 22, 88],
  ["Fen & Marlow", "2026-04-02", "senior designer", 14, 133], // OVER +12
  ["Halberd Design", "2026-03-09", "designer", 30, 118], // over, but EXCLUDED
  ["Halberd Design", "2026-04-11", "senior designer", 12, 140], // excluded
  ["Quillon Media", "2026-03-21", "editor", 16, 72],
  ["Quillon Media", "2026-04-04", "senior editor", 8, 99],
  ["Bracken Labs", "2026-02-19", "senior engineer", 20, 205], // over, PRE-renewal
  ["Bracken Labs", "2026-03-17", "engineer", 26, 140],
  ["Alder Copy", "2026-03-23", "writer", 11, 65],
  ["Alder Copy", "2026-04-08", "senior writer", 6, 104], // OVER +14
  ["Verrine Studio", "2026-03-12", "designer", 19, 84],
  ["Verrine Studio", "2026-04-15", "designer", 13, 84],
  ["Thistlewood Ops", "2026-03-30", "analyst", 24, 92],
  ["Thistlewood Ops", "2026-04-09", "senior analyst", 10, 126],
  ["Corvid Research", "2026-03-06", "analyst", 15, 98],
  ["Corvid Research", "2026-04-17", "senior analyst", 7, 149], // OVER +15
  ["Pellman & Roe", "2026-03-19", "engineer", 21, 132],
  ["Pellman & Roe", "2026-04-06", "senior engineer", 9, 178],
  ["Saltmarsh Audio", "2026-03-25", "editor", 17, 70],
  ["Saltmarsh Audio", "2026-04-13", "senior editor", 5, 96],
  ["Wrenfield Legal", "2026-02-24", "analyst", 8, 165], // over, PRE-renewal
  ["Wrenfield Legal", "2026-03-27", "analyst", 13, 150],
];

const outDir = join(import.meta.dir, "invoices");
mkdirSync(outDir, { recursive: true });

const slug = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const byVendor = new Map<string, typeof LINES>();
for (const line of LINES) {
  const list = byVendor.get(line[0]) ?? [];
  list.push(line);
  byVendor.set(line[0], list);
}
for (const [vendor, lines] of byVendor) {
  const rows = ["date,role,hours,rate_charged_eur"];
  for (const [, date, role, hours, rate] of lines) {
    rows.push(`${date},${role},${hours},${rate}`);
  }
  writeFileSync(join(outDir, `${slug(vendor)}.csv`), rows.join("\n") + "\n");
}

const rateRows = ["vendor,role,agreed_rate_eur"];
for (const [vendor, roles] of Object.entries(RATES)) {
  for (const [role, rate] of Object.entries(roles)) {
    rateRows.push(`${vendor},${role},${rate}`);
  }
}
writeFileSync(join(import.meta.dir, "rates.csv"), rateRows.join("\n") + "\n");

// Ground truth under ALL THREE user constraints.
const overcharges: Array<{ vendor: string; excess: number }> = [];
let total = 0;
for (const [vendor, date, role, hours, charged] of LINES) {
  if (vendor === EXCLUDED) continue;
  if (date < RENEWAL) continue;
  const agreed = RATES[vendor][role];
  if (charged <= agreed) continue;
  const excess = (charged - agreed) * hours;
  overcharges.push({ vendor, excess });
  total += excess;
}
console.log(JSON.stringify({ overcharges, total }, null, 2));
