import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseEntries, type Entry } from "./schema";

/**
 * The default data file, resolved from the project root rather than the
 * working directory, so every command reads the same file no matter where
 * it is run from.
 */
const DEFAULT_DATA_FILE = join(
  import.meta.dir,
  "..",
  "..",
  "data",
  "expenses.json",
);

/**
 * Where entries are read and written. EXPENSES_FILE overrides the default
 * so tests and other tooling can work on a copy of the data instead of the
 * real file.
 */
export function dataFilePath(): string {
  const override = process.env.EXPENSES_FILE;
  return override === undefined || override === ""
    ? DEFAULT_DATA_FILE
    : override;
}

/** Read every entry. A missing file counts as no entries yet. */
export function loadEntries(): Entry[] {
  const path = dataFilePath();
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${path} does not hold valid JSON.`);
  }
  return parseEntries(parsed);
}

/** Write every entry back, oldest date first. */
export function saveEntries(entries: Entry[]): void {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  writeFileSync(dataFilePath(), `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}
