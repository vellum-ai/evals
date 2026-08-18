import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadTestDef } from "../test-def";
import {
  DEFECTIVE_INVOICE_CENTS,
  EXPECTED_INVOICE_CENTS,
  FAILING_PACKAGE,
  PACKAGE_COUNT,
  PACKAGE_NAMES,
  SHIPYARD_DIR,
} from "../../../benchmarks/personal-intelligence/lib/fixtures/shipyard/truth";
import {
  CHEAPEST,
  QUOTE_COUNT,
  QUOTE_TRUTH,
  QUOTES_DIR,
} from "../../../benchmarks/personal-intelligence/lib/fixtures/supplier-quotes/truth";

const benchmarkDir = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "benchmarks",
  "personal-intelligence",
);
const unitsDir = join(benchmarkDir, "tests");
const shipyardDir = join(
  benchmarkDir,
  "lib",
  "fixtures",
  "shipyard",
  "project",
);
const quotesDir = join(
  benchmarkDir,
  "lib",
  "fixtures",
  "supplier-quotes",
  "quotes",
);

describe("shipyard fixture", () => {
  test("ships broken, in exactly one package", () => {
    // The whole case rests on this: the check names one failing package
    // on its first run, so fanning out over the other thirteen is waste.
    const run = Bun.spawnSync(["bun", "run", "check.ts"], {
      cwd: shipyardDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const lines = run.stdout.toString().split("\n");
    const failing = lines.filter((line) => line.startsWith("FAIL"));
    expect(run.exitCode).toBe(1);
    expect(failing).toHaveLength(1);
    expect(failing[0]).toContain(FAILING_PACKAGE);
    expect(lines.filter((line) => line.startsWith("PASS"))).toHaveLength(
      PACKAGE_COUNT - 1,
    );
  });

  test("the defect is the one cent the truth file names", () => {
    expect(EXPECTED_INVOICE_CENTS - DEFECTIVE_INVOICE_CENTS).toBe(1);
  });

  test("the generated tree matches the committed package list", () => {
    const onDisk = readdirSync(join(shipyardDir, "packages")).sort();
    expect(onDisk).toEqual([...PACKAGE_NAMES]);
    expect(onDisk.length).toBe(PACKAGE_COUNT);
  });
});

describe("supplier-quotes fixture", () => {
  test("every quote file adds up to the committed total", () => {
    // Guards the regenerate-only rule: an edited unit price would move a
    // total and this test, not a run, catches it.
    for (const quote of QUOTE_TRUTH) {
      const slug = quote.supplier.toLowerCase().replace(/\s+/g, "-");
      const text = readFileSync(join(quotesDir, `${slug}.txt`), "utf8");
      const cents = [...text.matchAll(/^\s{2}(\d+) x .*?([\d.]+) each$/gm)]
        .map((match) => Number(match[1]) * Math.round(Number(match[2]) * 100))
        .reduce((total, value) => total + value, 0);
      expect(cents).toBe(quote.totalCents);
      expect(text).toContain(`Delivery: ${quote.leadDays} working days`);
    }
  });

  test("the cheapest quote is not the fastest, so the answer needs working out", () => {
    const fastest = QUOTE_TRUTH.reduce((best, row) =>
      row.leadDays < best.leadDays ? row : best,
    );
    expect(CHEAPEST.supplier).not.toBe(fastest.supplier);
    expect(readdirSync(quotesDir)).toHaveLength(QUOTE_COUNT);
  });

  test("no quote's total is printed in any quote file", () => {
    // The totals have to be computed: an assistant that greps for the
    // answer must not find it lying about.
    for (const quote of QUOTE_TRUTH) {
      for (const file of readdirSync(quotesDir)) {
        expect(readFileSync(join(quotesDir, file), "utf8")).not.toContain(
          quote.total.replace("$", ""),
        );
      }
    }
  });
});

describe("delegation-restraint test definitions", () => {
  const cases = [
    { id: "shipyard-red-check", dir: SHIPYARD_DIR, staged: 59 },
    { id: "supplier-quote-verdicts", dir: QUOTES_DIR, staged: QUOTE_COUNT },
  ];

  for (const { id, dir, staged } of cases) {
    test(`${id} is experimental and stages its fixture under ${dir}/`, async () => {
      const def = await loadTestDef(id, unitsDir);
      expect(def.status).toBe("experimental");
      const paths = def.setupCommands.map((command) =>
        command.type === "stage-workspace-file" ? command.path : "",
      );
      expect(paths).toHaveLength(staged);
      expect(paths.every((path) => path.startsWith(`${dir}/`))).toBe(true);
    });

    test(`${id} registers a spawn-restraint metric`, async () => {
      const def = await loadTestDef(id, unitsDir);
      expect(def.metricPaths.map((path) => path.split("/").pop())).toContain(
        "spawn-restraint.ts",
      );
    });
  }
});
