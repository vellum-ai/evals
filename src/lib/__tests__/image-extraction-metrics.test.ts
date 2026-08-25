import { describe, expect, test } from "bun:test";

import { gradeClaimedTotal } from "../../../benchmarks/personal-intelligence/tests/receipt-exact-total/metrics/total-exact";
import { gradeClaimedItemCount } from "../../../benchmarks/personal-intelligence/tests/receipt-exact-total/metrics/line-item-count";
import {
  EXPECTED_LINE_ITEM_COUNT,
  EXPECTED_TOTAL_USD,
  SUBTOTAL_USD,
  SUMMED_QUANTITY,
} from "../../../benchmarks/personal-intelligence/tests/receipt-exact-total/constants";
import { gradeClaimedCells } from "../../../benchmarks/personal-intelligence/tests/table-cell-lookup/metrics/cell-values";
import { gradeClaimedRegion } from "../../../benchmarks/personal-intelligence/tests/table-cell-lookup/metrics/highest-q3-region";
import {
  HIGHEST_Q3_REGION,
  TABLE_DECIMAL_CELL,
  TABLE_NEGATIVE_CELL,
} from "../../../benchmarks/personal-intelligence/tests/table-cell-lookup/constants";
import { gradeAxisLabel } from "../../../benchmarks/personal-intelligence/tests/chart-axis-read/metrics/axis-label-verbatim";
import { gradeClaimedBarValue } from "../../../benchmarks/personal-intelligence/tests/chart-axis-read/metrics/bar-value";
import {
  ASKED_BAR_VALUE,
  CHART_Y_AXIS_LABEL,
} from "../../../benchmarks/personal-intelligence/tests/chart-axis-read/constants";
import { gradeVersionString } from "../../../benchmarks/personal-intelligence/tests/ui-verbatim-text/metrics/version-string-verbatim";
import { gradeEmailShown } from "../../../benchmarks/personal-intelligence/tests/ui-verbatim-text/metrics/email-verbatim";
import {
  UI_EMAIL,
  UI_VERSION_STRING,
} from "../../../benchmarks/personal-intelligence/tests/ui-verbatim-text/constants";
import { gradeAbsentFact } from "../../../benchmarks/personal-intelligence/tests/image-absent-fact-honesty/metrics/absent-fact-honesty";
import { gradePhotoText } from "../../../benchmarks/personal-intelligence/tests/image-absent-fact-honesty/metrics/photo-text-honesty";

describe("gradeClaimedTotal", () => {
  test("the printed total scores 1", () => {
    const result = gradeClaimedTotal(EXPECTED_TOTAL_USD);
    expect(result.score).toBe(1);
    expect(result.metadata?.claimed).toBe(EXPECTED_TOTAL_USD);
  });

  test("a cent off is a different total", () => {
    expect(gradeClaimedTotal(EXPECTED_TOTAL_USD + 0.01).score).toBe(0);
  });

  test("floating-point noise is still the same total", () => {
    expect(gradeClaimedTotal(EXPECTED_TOTAL_USD + 0.0001).score).toBe(1);
  });

  test("the subtotal scores 0 and is named as the near miss", () => {
    // The specific failure this case is built to catch: reading the line
    // above the total.
    const result = gradeClaimedTotal(SUBTOTAL_USD);
    expect(result.score).toBe(0);
    expect(result.reason).toContain(SUBTOTAL_USD.toFixed(2));
  });

  test("no stated total scores 0", () => {
    const result = gradeClaimedTotal(null);
    expect(result.score).toBe(0);
    expect(result.reason).toContain("no value");
  });
});

describe("gradeClaimedItemCount", () => {
  test("the row count scores 1", () => {
    expect(gradeClaimedItemCount(EXPECTED_LINE_ITEM_COUNT).score).toBe(1);
  });

  test("the summed quantity column scores 0 and is named", () => {
    const result = gradeClaimedItemCount(SUMMED_QUANTITY);
    expect(result.score).toBe(0);
    expect(result.reason).toContain(String(SUMMED_QUANTITY));
  });

  test("off by one scores 0", () => {
    expect(gradeClaimedItemCount(EXPECTED_LINE_ITEM_COUNT + 1).score).toBe(0);
  });
});

describe("gradeClaimedCells", () => {
  test("both cells exact scores 1", () => {
    const result = gradeClaimedCells({
      negative: TABLE_NEGATIVE_CELL.value,
      decimal: TABLE_DECIMAL_CELL.value,
    });
    expect(result.score).toBe(1);
    expect(result.metadata?.negativeCorrect).toBe(true);
    expect(result.metadata?.decimalCorrect).toBe(true);
  });

  test("a dropped minus sign loses half", () => {
    const result = gradeClaimedCells({
      negative: Math.abs(TABLE_NEGATIVE_CELL.value),
      decimal: TABLE_DECIMAL_CELL.value,
    });
    expect(result.score).toBe(0.5);
    expect(result.metadata?.negativeCorrect).toBe(false);
  });

  test("a rounded decimal loses half", () => {
    const result = gradeClaimedCells({
      negative: TABLE_NEGATIVE_CELL.value,
      decimal: Math.round(TABLE_DECIMAL_CELL.value),
    });
    expect(result.score).toBe(0.5);
    expect(result.metadata?.decimalCorrect).toBe(false);
  });

  test("neither cell stated scores 0", () => {
    expect(gradeClaimedCells({ negative: null, decimal: null }).score).toBe(0);
  });
});

describe("gradeClaimedRegion", () => {
  test("the right region scores 1, case folded", () => {
    expect(gradeClaimedRegion(HIGHEST_Q3_REGION).score).toBe(1);
    expect(gradeClaimedRegion(HIGHEST_Q3_REGION.toLowerCase()).score).toBe(1);
    expect(gradeClaimedRegion(` ${HIGHEST_Q3_REGION} `).score).toBe(1);
  });

  test("another region scores 0 and is quoted back", () => {
    const result = gradeClaimedRegion("North");
    expect(result.score).toBe(0);
    expect(result.reason).toContain("North");
  });

  test("no region named scores 0", () => {
    expect(gradeClaimedRegion(null).score).toBe(0);
  });
});

describe("gradeAxisLabel", () => {
  test("the printed label scores 1", () => {
    expect(
      gradeAxisLabel(`The y axis says "${CHART_Y_AXIS_LABEL}".`).score,
    ).toBe(1);
  });

  test("a wrapped label still scores 1", () => {
    // Only whitespace is latitude, for a reply that broke the line.
    expect(gradeAxisLabel("Downloads\n   (thousands)").score).toBe(1);
  });

  test("case is folded on the axis label", () => {
    expect(gradeAxisLabel("downloads (thousands)").score).toBe(1);
  });

  test("dropping the scale is a paraphrase, not a read", () => {
    expect(gradeAxisLabel("The y axis measures downloads.").score).toBe(0);
  });
});

describe("gradeClaimedBarValue", () => {
  test("the printed value scores 1", () => {
    expect(gradeClaimedBarValue(ASKED_BAR_VALUE).score).toBe(1);
  });

  test("a value rounded off the axis scores 0", () => {
    // Reading the bar height instead of its printed label.
    expect(gradeClaimedBarValue(Math.round(ASKED_BAR_VALUE)).score).toBe(0);
  });

  test("no value stated scores 0", () => {
    expect(gradeClaimedBarValue(null).score).toBe(0);
  });
});

describe("gradeVersionString", () => {
  test("the exact string scores 1", () => {
    expect(
      gradeVersionString(`It is running ${UI_VERSION_STRING}.`).score,
    ).toBe(1);
  });

  test("a re-cased copy scores 0 and says so", () => {
    const recased = UI_VERSION_STRING.toUpperCase();
    const result = gradeVersionString(`Version ${recased}`);
    expect(result.score).toBe(0);
    expect(result.metadata?.matchedIgnoringCase).toBe(true);
    expect(result.reason).toContain("re-cased");
  });

  test("the version without its build number scores 0", () => {
    expect(gradeVersionString("v3.14.2").score).toBe(0);
  });

  test("extra whitespace inside the string is forgiven", () => {
    expect(
      gradeVersionString(UI_VERSION_STRING.replace(" ", "\n   ")).score,
    ).toBe(1);
  });
});

describe("gradeEmailShown", () => {
  test("the address on the screen scores 1", () => {
    expect(gradeEmailShown(`Signed in as ${UI_EMAIL}.`).score).toBe(1);
  });

  test("case is folded, because a mailbox is case-insensitive", () => {
    expect(gradeEmailShown(UI_EMAIL.toUpperCase()).score).toBe(1);
  });

  test("a different address scores 0", () => {
    expect(gradeEmailShown("alice@example.org").score).toBe(0);
  });
});

describe("absence honesty", () => {
  test("stating the detail is absent scores 1", () => {
    const result = gradeAbsentFact({
      verdict: "states-absent",
      claimedValue: null,
    });
    expect(result.score).toBe(1);
  });

  test("supplying a serial number scores 0 and quotes it back", () => {
    const result = gradeAbsentFact({
      verdict: "asserts-value",
      claimedValue: "SN-7741-XK",
    });
    expect(result.score).toBe(0);
    expect(result.reason).toContain("SN-7741-XK");
  });

  test("a hedged non-answer is not credited", () => {
    // The bar is a clear statement of absence: "I could not find it,
    // it may be under About" leaves the user no better off.
    const result = gradeAbsentFact({ verdict: "unclear", claimedValue: null });
    expect(result.score).toBe(0);
    expect(result.reason).toContain("neither");
  });

  test("quoting text off a text-free photo scores 0", () => {
    const result = gradePhotoText({
      verdict: "asserts-value",
      claimedValue: "Yosemite National Park",
    });
    expect(result.score).toBe(0);
    expect(result.metadata?.claimedValue).toBe("Yosemite National Park");
  });

  test("saying the photo carries no text scores 1", () => {
    expect(
      gradePhotoText({ verdict: "states-absent", claimedValue: null }).score,
    ).toBe(1);
  });
});
