import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dataFilePath, loadEntries, saveEntries } from "./store";

const originalOverride = process.env.EXPENSES_FILE;

function useTempDataFile(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "expenses-")), "expenses.json");
  writeFileSync(path, contents, "utf8");
  process.env.EXPENSES_FILE = path;
  return path;
}

afterEach(() => {
  if (originalOverride === undefined) {
    delete process.env.EXPENSES_FILE;
  } else {
    process.env.EXPENSES_FILE = originalOverride;
  }
});

describe("EXPENSES_FILE override", () => {
  test("reads entries from the file it points at", () => {
    const path = useTempDataFile(
      JSON.stringify([{ date: "2025-03-18", amount: 42.1, note: "test" }]),
    );
    expect(dataFilePath()).toBe(path);
    expect(loadEntries()).toEqual([
      { date: "2025-03-18", amount: 42.1, note: "test" },
    ]);
  });

  test("writes entries back to the file it points at", () => {
    const path = useTempDataFile("[]");
    saveEntries([
      { date: "2025-02-01", amount: 5, note: "second" },
      { date: "2025-01-01", amount: 10, note: "first" },
    ]);
    const written = JSON.parse(readFileSync(path, "utf8")) as unknown[];
    expect(written).toHaveLength(2);
    expect(loadEntries().map((entry) => entry.note)).toEqual([
      "first",
      "second",
    ]);
  });

  test("an empty override falls back to the project data file", () => {
    process.env.EXPENSES_FILE = "";
    expect(dataFilePath().endsWith(join("data", "expenses.json"))).toBe(true);
  });
});

describe("loadEntries", () => {
  test("a missing file counts as no entries", () => {
    process.env.EXPENSES_FILE = join(
      mkdtempSync(join(tmpdir(), "expenses-")),
      "absent.json",
    );
    expect(loadEntries()).toEqual([]);
  });

  test("a malformed entry is rejected with a clear error", () => {
    useTempDataFile(
      JSON.stringify([{ date: "March 18th", amount: 1, note: "x" }]),
    );
    expect(() => loadEntries()).toThrow(/bad date/);
  });

  test("text that is not JSON is rejected", () => {
    useTempDataFile("not json at all");
    expect(() => loadEntries()).toThrow(/valid JSON/);
  });
});
