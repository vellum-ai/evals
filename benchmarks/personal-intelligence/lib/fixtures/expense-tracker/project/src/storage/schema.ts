import { isValidDate } from "../format/dates";

/** One recorded expense. */
export type Entry = {
  date: string;
  amount: number;
  note: string;
};

function parseEntry(value: unknown, index: number): Entry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Entry ${index} is not an object.`);
  }
  const record = value as Record<string, unknown>;
  const { date, amount, note } = record;
  if (typeof date !== "string" || !isValidDate(date)) {
    throw new Error(`Entry ${index} has a bad date: ${String(date)}.`);
  }
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error(`Entry ${index} has a bad amount: ${String(amount)}.`);
  }
  if (typeof note !== "string" || note.trim() === "") {
    throw new Error(`Entry ${index} has an empty note.`);
  }
  return { date, amount, note };
}

/** Validate raw JSON as a list of entries, or throw explaining what is wrong. */
export function parseEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) {
    throw new Error("The expenses file must hold a list of entries.");
  }
  return value.map(parseEntry);
}
