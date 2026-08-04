#!/usr/bin/env bun
// generate.ts — regenerates the freezer manifests and prints the ground
// truth for constants.ts. Run from this directory:  bun generate.ts
// Never hand-edit manifests/ or the constants it prints.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REAGENTS = ["Tris-HCl", "EDTA", "SDS", "Glycerol"];

// [team, sampleId, reagent, volume, unit]
type Row = [number, string, string, number, string];
const rows: Row[] = [];

// Deterministic filler: 15 teams x 4 rows, all in µL.
let sample = 1;
for (let team = 1; team <= 15; team += 1) {
  for (let i = 0; i < 4; i += 1) {
    const reagent = REAGENTS[(team + i) % REAGENTS.length];
    const volume = 100 + ((team * 7 + i * 13) % 9) * 25;
    rows.push([team, `S-${String(sample).padStart(3, "0")}`, reagent, volume, "uL"]);
    sample += 1;
  }
}

// TRAP 1 — team 09 recorded in mL while everyone else used µL. Same
// column, different scale: summing the numbers as-is under-counts by
// 1000x per row.
for (const row of rows) {
  if (row[0] === 9) {
    row[3] = row[3] / 1000; // same physical volume, expressed in mL
    row[4] = "mL";
  }
}

// TRAP 2 — S-006 was logged by team 02 and again by team 11 when the
// box moved shelves. It is ONE physical sample; counting both
// double-counts it.
const dup = rows.find((r) => r[1] === "S-006")!;
rows.push([11, dup[1], dup[2], dup[3], dup[4]]);

const outDir = join(import.meta.dir, "manifests");
mkdirSync(outDir, { recursive: true });
for (let team = 1; team <= 15; team += 1) {
  const mine = rows.filter((r) => r[0] === team);
  const lines = ["sample_id,reagent,volume,unit"];
  for (const [, id, reagent, volume, unit] of mine) {
    lines.push(`${id},${reagent},${volume},${unit}`);
  }
  writeFileSync(
    join(outDir, `team-${String(team).padStart(2, "0")}.csv`),
    lines.join("\n") + "\n",
  );
}

// Ground truth: per-reagent totals in µL, deduped by sample_id and with
// mL converted. First occurrence of a sample_id wins.
const seen = new Set<string>();
const totals: Record<string, number> = {};
for (const [, id, reagent, volume, unit] of rows) {
  if (seen.has(id)) continue;
  seen.add(id);
  const uL = unit === "mL" ? volume * 1000 : volume;
  totals[reagent] = (totals[reagent] ?? 0) + uL;
}
// The number a careless pass produces: no dedup, no conversion.
let naive = 0;
for (const [, , , volume] of rows) naive += volume;
console.log(
  JSON.stringify(
    {
      totals,
      grandTotalUL: Object.values(totals).reduce((a, b) => a + b, 0),
      naiveSumIfTrapsMissed: naive,
      duplicateSampleId: "S-006",
      mismatchedUnitTeam: "team-09",
    },
    null,
    2,
  ),
);
