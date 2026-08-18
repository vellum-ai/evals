import { isValidMonth, monthOf } from "../format/dates";
import { formatUsd, sumUsd } from "../format/money";
import { loadEntries } from "../storage/store";

/** Print how much one month came to. */
export function runReportMonth(month: string): void {
  if (!isValidMonth(month)) {
    throw new Error(`Write the month as YYYY-MM, not ${month}.`);
  }
  const entries = loadEntries().filter(
    (entry) => monthOf(entry.date) === month,
  );
  const total = sumUsd(entries.map((entry) => entry.amount));
  console.log(`Report for ${month}`);
  console.log(`  entries: ${entries.length}`);
  console.log(`  total:   ${formatUsd(total)}`);
}
