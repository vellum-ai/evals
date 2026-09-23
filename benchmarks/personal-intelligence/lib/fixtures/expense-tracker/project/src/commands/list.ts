import { formatUsd } from "../format/money";
import { formatTable } from "../format/table";
import { loadEntries } from "../storage/store";

/** Print every expense, oldest first, in aligned columns. */
export function runList(): void {
  const entries = [...loadEntries()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (entries.length === 0) {
    console.log("No expenses yet.");
    return;
  }
  const rows = [
    ["DATE", "AMOUNT", "NOTE"],
    ...entries.map((entry) => [
      entry.date,
      formatUsd(entry.amount),
      entry.note,
    ]),
  ];
  console.log(formatTable(rows, ["left", "right", "left"]));
}
