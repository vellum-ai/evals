import { isValidDate } from "../format/dates";
import { formatUsd } from "../format/money";
import { loadEntries, saveEntries } from "../storage/store";

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Record one expense and print what was saved. */
export function runAdd(date: string, amount: string, note: string): void {
  if (!isValidDate(date)) {
    throw new Error(`Write the date as YYYY-MM-DD, not ${date}.`);
  }
  if (!AMOUNT_PATTERN.test(amount)) {
    throw new Error(`Write the amount as dollars and cents, not ${amount}.`);
  }
  if (note.trim() === "") {
    throw new Error("Give the expense a note.");
  }
  const entry = { date, amount: Number(amount), note: note.trim() };
  saveEntries([...loadEntries(), entry]);
  console.log(`Added ${entry.date}  ${formatUsd(entry.amount)}  ${entry.note}`);
}
