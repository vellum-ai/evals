import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { TestSetupCommand } from "../../../../src/lib/setup-command";

// Stage the consultancy's quarter: what twelve contractors billed, and
// the rate card they agreed to. Nothing here encodes the renewal date,
// the excluded vendor, or the currency — those live only in the
// conversation, which is what makes the handoff worth measuring.
const assetsDir = join(import.meta.dir, "assets");
const asset = (...parts: string[]): string =>
  readFileSync(join(assetsDir, ...parts), "utf8");

const invoiceFiles: TestSetupCommand[] = readdirSync(
  join(assetsDir, "invoices"),
)
  .filter((name) => name.endsWith(".csv"))
  .sort()
  .map((name) => ({
    type: "stage-workspace-file",
    path: `invoices/${name}`,
    content: asset("invoices", name),
  }));

export default [
  ...invoiceFiles,
  {
    type: "stage-workspace-file",
    path: "rates.csv",
    content: asset("rates.csv"),
  },
] satisfies TestSetupCommand[];
