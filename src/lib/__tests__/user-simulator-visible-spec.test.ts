import { describe, expect, test } from "bun:test";

import {
  scriptedOpener,
  simulatorVisibleSpec,
} from "../simulator/user-simulator";

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

  test("cross-file-survey's visible portion carries no ground truth", async () => {
    // Regression: the answer key (count, trap service names, resolved
    // constants) once sat ABOVE the redaction cut, one clarifying
    // question away from the tested agent.
    const spec = await Bun.file(
      "benchmarks/personal-intelligence/tests/cross-file-survey/SPEC.md",
    ).text();
    const visible = simulatorVisibleSpec(spec);
    expect(visible).not.toContain("## Fixtures");
    for (const leak of [
      "billing-api",
      "search-worker",
      "exports-api",
      "analytics-worker",
      "profiles-api",
      "120",
      "20s",
      "has 14",
      "exactly 10",
    ]) {
      expect(visible, `visible spec must not contain "${leak}"`).not.toContain(
        leak,
      );
    }
  });
});

describe("scriptedOpener", () => {
  test("rejoins a wrapped blockquote into the single line the user sends", () => {
    const spec = [
      "## What you ask",
      "",
      "Open the conversation with this message, verbatim:",
      "",
      "> Episode 19's transcript is in your workspace as",
      "> episodes/ep019-transcript.txt. Publish it like the others.",
      "",
      "## How you respond",
      "- Keep it short.",
    ].join("\n");
    expect(scriptedOpener(spec)).toBe(
      "Episode 19's transcript is in your workspace as " +
        "episodes/ep019-transcript.txt. Publish it like the others.",
    );
  });

  test("stops at the quote and never swallows the prose after it", () => {
    const spec = [
      "Open the conversation with this message, verbatim:",
      "",
      "> Publish episode 19.",
      "",
      "## How you respond",
      "- Never mention that a script exists.",
    ].join("\n");
    expect(scriptedOpener(spec)).toBe("Publish episode 19.");
  });

  test("returns undefined for a spec that scripts no opener", () => {
    // ecomm-support-chat has no cue line; it keeps the model-driven path.
    expect(scriptedOpener("## Your role\nImprovise freely.\n")).toBeUndefined();
  });

  test("throws when the cue has no blockquote rather than silently falling back", () => {
    // Silently reverting to the model would restore the nondeterminism
    // this exists to remove — and hide the authoring error that caused it.
    const spec = [
      "Open the conversation with this message, verbatim:",
      "",
      "Publish episode 19.",
    ].join("\n");
    expect(() => scriptedOpener(spec)).toThrow(/no blockquote follows/);
  });

  test("every shipped SPEC with the cue yields a non-empty opener", async () => {
    // The guard that matters in practice: this parser runs against real
    // SPECs at run time, and a parse failure there costs a whole hatch.
    const { Glob } = await import("bun");
    const specs = await Array.fromAsync(
      new Glob("benchmarks/*/tests/*/SPEC*.md").scan("."),
    );
    expect(specs.length).toBeGreaterThan(0);
    for (const path of specs) {
      const text = await Bun.file(path).text();
      if (!text.includes("Open the conversation with this message, verbatim:"))
        continue;
      const opener = scriptedOpener(text);
      expect(opener, `${path} should yield an opener`).toBeTruthy();
      expect(
        opener,
        `${path} opener should not keep quote markers`,
      ).not.toContain(">");
    }
  });
});
