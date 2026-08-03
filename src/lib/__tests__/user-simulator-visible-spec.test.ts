import { describe, expect, test } from "bun:test";

import { simulatorVisibleSpec } from "../simulator/user-simulator";

describe("simulatorVisibleSpec", () => {
  test("truncates at Fixtures so the answer key never reaches the simulator", () => {
    const spec = [
      "# t",
      "## Your role",
      "You are a user.",
      "## End condition",
      "Stop when done.",
      "## Fixtures",
      "The secret script scripts/build_shownotes.ts floors chapters to 30s.",
      "## Success criteria (scored by metrics)",
      "- exact total is $256.93",
    ].join("\n");
    const visible = simulatorVisibleSpec(spec);
    expect(visible).toContain("## End condition");
    expect(visible).not.toContain("build_shownotes.ts");
    expect(visible).not.toContain("256.93");
  });

  test("truncates at Success criteria when there is no Fixtures section", () => {
    const spec =
      "## Your role\nx\n## Success criteria (scored by metrics)\nsecret";
    expect(simulatorVisibleSpec(spec)).not.toContain("secret");
  });

  test("specs without either section pass through whole", () => {
    const spec = "## Your role\nx\n## End condition\ny\n";
    expect(simulatorVisibleSpec(spec)).toBe(spec);
  });
});
