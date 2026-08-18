import { formatUsd, sumUsd } from "../format/money";
import { loadEntries } from "../storage/store";

/** Print how much every recorded expense comes to. */
export function runReportTotal(): void {
  const entries = loadEntries();
  const total = sumUsd(entries.map((entry) => entry.amount));
  console.log("Report for every expense");
  console.log(`  entries: ${entries.length}`);
  console.log(`  total:   ${formatUsd(total)}`);
}
