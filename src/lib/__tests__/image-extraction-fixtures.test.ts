import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadTestDef } from "../test-def";
import {
  CHART_ASKED_BAR,
  CHART_BARS,
  CHART_Y_AXIS_TICKS,
  lineAmountCents,
  RECEIPT_LINE_ITEM_COUNT,
  RECEIPT_LINE_ITEMS,
  RECEIPT_SUBTOTAL_CENTS,
  RECEIPT_TAX_CENTS,
  RECEIPT_TAX_RATE,
  RECEIPT_TOTAL_CENTS,
  RECEIPT_TOTAL_QUANTITY,
  TABLE_COLUMNS,
  TABLE_DECIMAL_CELL,
  TABLE_HIGHEST_Q3,
  TABLE_NEGATIVE_CELL,
  TABLE_ROWS,
  UI_EMAIL,
  UI_VERSION_STRING,
} from "../../../benchmarks/personal-intelligence/lib/fixtures/image-extraction/content";
import {
  assertFixtureInvariants,
  FIXTURE_IMAGES,
  MAX_FIXTURE_BYTES,
} from "../../../benchmarks/personal-intelligence/lib/fixtures/image-extraction/images";
import { decodePng } from "../../../benchmarks/personal-intelligence/lib/fixtures/image-extraction/png";

const benchmarkDir = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "benchmarks",
  "personal-intelligence",
);
const unitsDir = join(benchmarkDir, "tests");
const imagesDir = join(
  benchmarkDir,
  "lib",
  "fixtures",
  "image-extraction",
  "images",
);

/** Every case built on these images, with the fixtures it stages. */
const CASES: ReadonlyArray<{ id: string; staged: string[] }> = [
  { id: "receipt-exact-total", staged: ["receipt.png"] },
  { id: "table-cell-lookup", staged: ["table.png"] },
  { id: "chart-axis-read", staged: ["chart.png"] },
  { id: "ui-verbatim-text", staged: ["ui-screenshot.png"] },
  {
    id: "image-absent-fact-honesty",
    staged: ["ui-screenshot.png", "photo.png"],
  },
];

describe("image-extraction ground truth", () => {
  test("the committed invariants hold", () => {
    expect(() => assertFixtureInvariants()).not.toThrow();
  });

  test("the receipt adds up the way a reader can check", () => {
    // The whole case rests on this: a run that reads every row can
    // verify its own total, so a wrong total means a wrong read.
    const summed = RECEIPT_LINE_ITEMS.reduce(
      (total, item) => total + lineAmountCents(item),
      0,
    );
    expect(summed).toBe(RECEIPT_SUBTOTAL_CENTS);
    expect(RECEIPT_TAX_CENTS).toBe(
      Math.round(RECEIPT_SUBTOTAL_CENTS * RECEIPT_TAX_RATE),
    );
    expect(RECEIPT_SUBTOTAL_CENTS + RECEIPT_TAX_CENTS).toBe(
      RECEIPT_TOTAL_CENTS,
    );
  });

  test("the receipt's count trap is distinguishable from its answer", () => {
    // Summing the quantity column instead of counting rows has to give a
    // different number, or the metric cannot tell the mistake from the
    // right answer.
    expect(RECEIPT_LINE_ITEM_COUNT).not.toBe(RECEIPT_TOTAL_QUANTITY);
    expect(RECEIPT_LINE_ITEM_COUNT).toBe(RECEIPT_LINE_ITEMS.length);
  });

  test("no receipt figure can be guessed off another one", () => {
    const amounts = RECEIPT_LINE_ITEMS.map(lineAmountCents);
    for (const amount of amounts) {
      expect(amount).not.toBe(RECEIPT_TOTAL_CENTS);
      expect(amount).not.toBe(RECEIPT_TAX_CENTS);
    }
  });

  test("the table carries exactly one negative and one decimal cell", () => {
    const values = TABLE_ROWS.flatMap((row) => row.values);
    expect(values.filter((value) => value < 0)).toEqual([
      TABLE_NEGATIVE_CELL.value,
    ]);
    expect(values.filter((value) => !Number.isInteger(value))).toEqual([
      TABLE_DECIMAL_CELL.value,
    ]);
  });

  test("exactly one region holds the highest Q3", () => {
    const q3 = TABLE_COLUMNS.indexOf("Q3");
    const best = TABLE_HIGHEST_Q3.values[q3];
    expect(TABLE_ROWS.filter((row) => row.values[q3] === best)).toHaveLength(1);
  });

  test("the asked bar is neither the tallest nor the shortest", () => {
    // It has to be found by its name, not by being the extreme one.
    const values = CHART_BARS.map((bar) => bar.value);
    expect(CHART_ASKED_BAR.value).not.toBe(Math.max(...values));
    expect(CHART_ASKED_BAR.value).not.toBe(Math.min(...values));
    expect(CHART_ASKED_BAR.value).toBeLessThanOrEqual(
      CHART_Y_AXIS_TICKS[CHART_Y_AXIS_TICKS.length - 1],
    );
  });

  test("the graded UI strings are the ones the image draws", () => {
    expect(UI_VERSION_STRING).toMatch(/^v\d+\.\d+\.\d+ \(build \d+\)$/);
    expect(UI_EMAIL).toMatch(/@example\.com$/);
  });
});

describe("committed image fixtures", () => {
  for (const { name, draw } of FIXTURE_IMAGES) {
    test(`${name} matches a fresh render`, () => {
      // Compared on decoded PIXELS, not file bytes: the compressed
      // stream depends on the platform's zlib, the picture does not. A
      // failure here means `content.ts` moved and the generator was
      // never re-run.
      const committed = decodePng(
        new Uint8Array(readFileSync(join(imagesDir, name))),
      );
      const fresh = draw();
      expect(committed.width).toBe(fresh.width);
      expect(committed.height).toBe(fresh.height);
      expect(
        Buffer.from(committed.pixels).equals(Buffer.from(fresh.pixels)),
      ).toBe(true);
    });

    test(`${name} stays small enough to stage`, () => {
      const bytes = readFileSync(join(imagesDir, name));
      expect(bytes.length).toBeLessThan(MAX_FIXTURE_BYTES);
    });
  }
});

describe("image-extraction cases", () => {
  for (const { id, staged } of CASES) {
    test(`${id} stages its images and ships experimental`, async () => {
      const test_ = await loadTestDef(id, unitsDir);
      // Experimental keeps these out of an unfiltered run until they
      // have been through QA, exactly like the other new cases.
      expect(test_.status).toBe("experimental");
      expect(test_.metricPaths.length).toBeGreaterThanOrEqual(3);
      expect(test_.setupCommands).toHaveLength(staged.length);
      for (const [index, command] of test_.setupCommands.entries()) {
        expect(command.type).toBe("stage-workspace-file");
        if (command.type !== "stage-workspace-file") continue;
        expect(command.path).toBe(staged[index]);
        // Base64, or the PNG bytes arrive corrupted.
        expect(command.encoding).toBe("base64");
        expect(command.content.length).toBeGreaterThan(0);
        expect(
          Buffer.from(command.content, "base64").subarray(1, 4).toString(),
        ).toBe("PNG");
      }
    });

    test(`${id} scores the image-ask diagnostic`, async () => {
      const test_ = await loadTestDef(id, unitsDir);
      expect(
        test_.metricPaths.some((path) => path.endsWith("image-ask-usage.ts")),
      ).toBe(true);
    });

    test(`every ${id} metric file exports a scorer`, async () => {
      // The runner imports these by path and calls the default export;
      // a metric that forgot one only fails at run time, after Docker.
      const test_ = await loadTestDef(id, unitsDir);
      for (const path of test_.metricPaths) {
        const imported = (await import(path)) as { default?: unknown };
        expect(typeof imported.default).toBe("function");
      }
    });
  }
});
