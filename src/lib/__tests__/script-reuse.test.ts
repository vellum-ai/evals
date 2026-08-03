import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import {
  containsScriptInvocation,
  hasExecutionResultEvidence,
} from "../common-metrics/script-reuse";

const event = (message: AgentEvent["message"]): AgentEvent => ({ message });

describe("hasExecutionResultEvidence", () => {
  test("a bash tool result carrying the script's stdout counts", () => {
    const events = [
      event({
        type: "tool_use_start",
        toolName: "bash",
        input: { command: "cd /workspace && bun scripts/weekly_recap.ts 8" },
      }),
      event({
        type: "tool_result",
        toolName: "bash",
        result: "Generating recap...\nwrote recaps/week_8.md\n",
      }),
    ];
    expect(hasExecutionResultEvidence(events, "wrote recaps/week_8.md")).toBe(
      true,
    );
  });

  test("invocation-shaped mentions in tool inputs do NOT count", () => {
    // Smoke-run regression: a `cat > SKILL.md <<EOF` heredoc contained
    // "bun {baseDir}/scripts/build_shownotes.ts" — a bash *input* that
    // never executed the script.
    const events = [
      event({
        type: "tool_use_start",
        toolName: "bash",
        input: {
          command:
            "cat > /workspace/skills/publish/SKILL.md << 'EOF'\nrun bun scripts/build_shownotes.ts\nEOF",
        },
      }),
      event({
        type: "tool_result",
        toolName: "bash",
        result: "",
      }),
      event({
        type: "tool_use_start",
        toolName: "file_write",
        input: { path: "/workspace/shownotes/ep018.md", content: "# Ep. 018" },
      }),
    ];
    expect(hasExecutionResultEvidence(events, "wrote shownotes/ep018.md")).toBe(
      false,
    );
  });

  test("narration quoting the success line is not a tool result", () => {
    const events = [
      event({ type: "message_chunk", text: "wrote shownotes/ep018.md" }),
    ];
    expect(hasExecutionResultEvidence(events, "wrote shownotes/ep018.md")).toBe(
      false,
    );
  });
});

describe("hasExecutionResultEvidence tool-name gating", () => {
  test("a file_read result echoing the success line does NOT count", () => {
    const events = [
      event({
        type: "tool_result",
        toolName: "file_read",
        result: "notes say: wrote recaps/week_8.md",
      }),
    ];
    expect(hasExecutionResultEvidence(events, "wrote recaps/week_8.md")).toBe(
      false,
    );
  });
});

describe("containsScriptInvocation", () => {
  const f = "build_shownotes.ts";

  test("runner-prefixed invocations count", () => {
    expect(
      containsScriptInvocation("Run: bun scripts/build_shownotes.ts <file>", f),
    ).toBe(true);
    expect(
      containsScriptInvocation("bun {baseDir}/scripts/build_shownotes.ts x", f),
    ).toBe(true);
    expect(
      containsScriptInvocation("execute scripts/build_shownotes.ts", f),
    ).toBe(true);
  });

  test("prose mentions do NOT count", () => {
    expect(
      containsScriptInvocation(
        "The old workflow used a script called build_shownotes.ts; do it by hand instead.",
        f,
      ),
    ).toBe(false);
  });
});
