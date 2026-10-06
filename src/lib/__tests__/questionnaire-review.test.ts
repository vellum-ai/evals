import { describe, expect, test } from "bun:test";

import {
  readVerdict,
  scoreReviewText,
} from "../common-metrics/questionnaire-review";

const VENDORS = [
  { vendor: "Arbor Analytics", encryptsAtRest: true, soc2: true },
  { vendor: "Cedarpost Mail", encryptsAtRest: false, soc2: false },
];

describe("questionnaire review reading", () => {
  test("a verdict is read through the decoration around it", () => {
    expect(readVerdict("x — at rest: yes — soc 2: no", "at rest")).toBe(true);
    expect(readVerdict("x — **at rest:** no", "at rest")).toBe(false);
    expect(readVerdict("x — SOC2 — yes", "soc ?2")).toBe(true);
  });

  test("a line that never answers the question reads as unanswered", () => {
    // Not the same as answering "no": the metric has to be able to say
    // "you did not tell me" rather than scoring a silence as a verdict.
    expect(
      readVerdict("Arbor Analytics — looks fine", "at rest"),
    ).toBeUndefined();
  });

  test("a correct review scores full marks", () => {
    const text = [
      "Arbor Analytics — at rest: yes — SOC 2: yes — flags: none",
      "Cedarpost Mail — at rest: no — SOC 2: no — flags: unlogged staff access",
    ].join("\n");
    expect(scoreReviewText(text, VENDORS).score).toBe(1);
  });

  test("a wrong answer costs its vendor", () => {
    const text = [
      "Arbor Analytics — at rest: yes — SOC 2: yes",
      "Cedarpost Mail — at rest: yes — SOC 2: no",
    ].join("\n");
    const result = scoreReviewText(text, VENDORS);
    expect(result.score).toBe(0.5);
    expect(result.checks[1].detail).toContain("read at rest=true");
  });

  test("a missing vendor is a failure, not an absence", () => {
    const text = "Arbor Analytics — at rest: yes — SOC 2: yes";
    const result = scoreReviewText(text, VENDORS);
    expect(result.score).toBe(0.5);
    expect(result.checks[1].detail).toContain("missing");
  });

  test("a cohort line is not read as its shorter namesake's answer", () => {
    // The wide arm carries "Arbor Analytics" and "Arbor Analytics
    // Systems". A naive substring match gives the Systems line to both
    // and scores a review that skipped one of them as complete.
    const vendors = [
      { vendor: "Arbor Analytics", encryptsAtRest: true, soc2: true },
      { vendor: "Arbor Analytics Systems", encryptsAtRest: false, soc2: false },
    ];
    const onlyCohort = "Arbor Analytics Systems — at rest: no — SOC 2: no";
    const result = scoreReviewText(onlyCohort, vendors);
    expect(result.score).toBe(0.5);
    expect(result.checks[0].detail).toContain("missing");

    const both = [
      "Arbor Analytics — at rest: yes — SOC 2: yes",
      "Arbor Analytics Systems — at rest: no — SOC 2: no",
    ].join("\n");
    expect(scoreReviewText(both, vendors).score).toBe(1);
  });
});
