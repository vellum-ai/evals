import { describe, expect, test } from "bun:test";

import {
  classifyScriptLeverage,
  extractWorkspaceScriptPaths,
  firesOnTuesday,
  isRecurring,
  normalizeScheduleRecord,
} from "../common-metrics/schedule-payload";

describe("normalizeScheduleRecord", () => {
  test("reads snake_case DB-shaped rows", () => {
    const view = normalizeScheduleRecord({
      id: "s1",
      name: "weekly recap",
      enabled: 1,
      mode: "script",
      cron_expression: "0 9 * * 2",
      schedule_syntax: "cron",
      script: "bun scripts/weekly_recap.ts 9",
    });
    expect(view.enabled).toBe(true);
    expect(view.mode).toBe("script");
    expect(view.expression).toBe("0 9 * * 2");
    expect(view.syntax).toBe("cron");
  });

  test("reads camelCase API-shaped rows and infers rrule syntax", () => {
    const view = normalizeScheduleRecord({
      enabled: true,
      expression: "DTSTART:20260804T090000\nRRULE:FREQ=WEEKLY;BYDAY=TU",
    });
    expect(view.mode).toBe("execute");
    expect(view.syntax).toBe("rrule");
  });

  test("one-shot rows (no expression) are not recurring", () => {
    const view = normalizeScheduleRecord({ mode: "execute", message: "hi" });
    expect(isRecurring(view)).toBe(false);
    expect(view.enabled).toBeUndefined();
  });

  test("enabled: 0 means disabled", () => {
    expect(normalizeScheduleRecord({ enabled: 0 }).enabled).toBe(false);
  });
});

describe("firesOnTuesday", () => {
  const cron = (expression: string) =>
    normalizeScheduleRecord({ cron_expression: expression });

  test("numeric and named day-of-week fields", () => {
    expect(firesOnTuesday(cron("0 9 * * 2"))).toBe(true);
    expect(firesOnTuesday(cron("0 9 * * TUE"))).toBe(true);
    expect(firesOnTuesday(cron("30 8 * * Tue"))).toBe(true);
    expect(firesOnTuesday(cron("0 9 * * 3"))).toBe(false);
  });

  test("lists and ranges containing Tuesday", () => {
    expect(firesOnTuesday(cron("0 9 * * 1,2,3"))).toBe(true);
    expect(firesOnTuesday(cron("0 9 * * 1-3"))).toBe(true);
    expect(firesOnTuesday(cron("0 9 * * 4-6"))).toBe(false);
  });

  test("daily wildcard is not 'every Tuesday'", () => {
    expect(firesOnTuesday(cron("0 9 * * *"))).toBe(false);
  });

  test("6-field cron puts day-of-week last", () => {
    expect(firesOnTuesday(cron("0 0 9 * * 2"))).toBe(true);
  });

  test("rrule BYDAY", () => {
    expect(
      firesOnTuesday(
        normalizeScheduleRecord({
          schedule_syntax: "rrule",
          cron_expression: "RRULE:FREQ=WEEKLY;BYDAY=TU",
        }),
      ),
    ).toBe(true);
    expect(
      firesOnTuesday(
        normalizeScheduleRecord({
          schedule_syntax: "rrule",
          cron_expression: "RRULE:FREQ=WEEKLY;BYDAY=WE",
        }),
      ),
    ).toBe(false);
  });

  test("one-shot never fires on Tuesday", () => {
    expect(firesOnTuesday(normalizeScheduleRecord({}))).toBe(false);
  });
});

describe("classifyScriptLeverage", () => {
  const token = "weekly_recap.ts";

  test("script mode invoking the script scores highest", () => {
    const view = normalizeScheduleRecord({
      mode: "script",
      script: "cd /workspace && bun scripts/weekly_recap.ts 9",
    });
    expect(classifyScriptLeverage(view, token)).toBe("script-mode");
  });

  test("execute-mode prompt naming the script is partial leverage", () => {
    const view = normalizeScheduleRecord({
      mode: "execute",
      message: "Run bun scripts/weekly_recap.ts for the latest week.",
    });
    expect(classifyScriptLeverage(view, token)).toBe("execute-references");
  });

  test("freeform prose payload is no leverage", () => {
    const view = normalizeScheduleRecord({
      mode: "execute",
      message: "Generate the weekly fantasy recap like the previous ones.",
    });
    expect(classifyScriptLeverage(view, token)).toBe("none");
  });

  test("script mode that shells to something else is not leverage", () => {
    const view = normalizeScheduleRecord({
      mode: "script",
      script: "python3 /workspace/other.py",
    });
    expect(classifyScriptLeverage(view, token)).toBe("none");
  });
});

describe("extractWorkspaceScriptPaths", () => {
  test("resolves $VELLUM_WORKSPACE_DIR-prefixed wrapper paths", () => {
    expect(
      extractWorkspaceScriptPaths(
        'bash "$VELLUM_WORKSPACE_DIR/scripts/gen_weekly_recap.sh"',
      ),
    ).toEqual(["scripts/gen_weekly_recap.sh"]);
  });

  test("resolves /workspace and ./ prefixes and dedupes", () => {
    expect(
      extractWorkspaceScriptPaths(
        "sh /workspace/run.sh && bun ./scripts/x.ts; sh /workspace/run.sh",
      ),
    ).toEqual(["run.sh", "scripts/x.ts"]);
  });

  test("bare relative invocations are found; absolute non-workspace paths are not", () => {
    expect(
      extractWorkspaceScriptPaths("bun scripts/weekly_recap.ts 9"),
    ).toEqual(["scripts/weekly_recap.ts"]);
    expect(extractWorkspaceScriptPaths("python3 /opt/tools/other.py")).toEqual(
      [],
    );
  });

  test("commands with no script paths yield nothing", () => {
    expect(extractWorkspaceScriptPaths("echo hello && date")).toEqual([]);
  });
});

describe("isOneShot handling", () => {
  test("COUNT=1 rrule with isOneShot true is not recurring", () => {
    const view = normalizeScheduleRecord({
      enabled: true,
      expression: "DTSTART:20260804T090000\nRRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=1",
      isOneShot: true,
    });
    expect(isRecurring(view)).toBe(false);
  });

  test("isOneShot false keeps a cron recurring", () => {
    const view = normalizeScheduleRecord({
      cron_expression: "0 9 * * 2",
      isOneShot: false,
    });
    expect(isRecurring(view)).toBe(true);
  });

  test("records predating the field stay recurring on expression alone", () => {
    expect(
      isRecurring(normalizeScheduleRecord({ expression: "0 9 * * 2" })),
    ).toBe(true);
  });
});

describe("firesOnTuesday DTSTART fallback", () => {
  test("FREQ=WEEKLY without BYDAY uses DTSTART weekday", () => {
    // 2026-08-04 is a Tuesday.
    expect(
      firesOnTuesday(
        normalizeScheduleRecord({
          expression: "DTSTART:20260804T090000\nRRULE:FREQ=WEEKLY",
        }),
      ),
    ).toBe(true);
    // 2026-08-05 is a Wednesday.
    expect(
      firesOnTuesday(
        normalizeScheduleRecord({
          expression: "DTSTART:20260805T090000\nRRULE:FREQ=WEEKLY",
        }),
      ),
    ).toBe(false);
  });
});
