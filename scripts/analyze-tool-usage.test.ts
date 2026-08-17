import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../src/lib/adapter";
import {
  classifyTerminalCommand,
  distinctFilePathsTouched,
} from "./analyze-tool-usage";

/** A direct tool call, the wire shape. */
function direct(toolName: string, input: Record<string, unknown>): AgentEvent {
  return { message: { type: "tool_use_start", toolName, input } };
}

/** A `skill_execute` envelope, the shape the daemon uses for skill tools. */
function dispatched(tool: string, input: Record<string, unknown>): AgentEvent {
  return {
    message: {
      type: "tool_use_start",
      toolName: "skill_execute",
      input: { tool, input, activity: "working" },
    },
  };
}

describe("classifyTerminalCommand: reads", () => {
  test("the pager and dump commands read a path argument", () => {
    // `head -50 ./x` and `tail -n 20 …` carry a numeric flag value that
    // must not be mistaken for the path, and must not hide the path.
    expect(classifyTerminalCommand("cat src/a.ts").readsFiles).toBe(true);
    expect(classifyTerminalCommand("head -50 ./x").readsFiles).toBe(true);
    expect(
      classifyTerminalCommand("tail -n 20 /workspace/y.log").readsFiles,
    ).toBe(true);
    expect(classifyTerminalCommand("less /workspace/notes.md").readsFiles).toBe(
      true,
    );
  });

  test("sed -n and awk read, with their quoted programs ignored", () => {
    // The quoted span is the program, not a path: stripping it is what
    // keeps `1,50p` and `{print}` out of the argument list.
    expect(classifyTerminalCommand("sed -n '1,50p' f.ts").readsFiles).toBe(
      true,
    );
    expect(classifyTerminalCommand("awk '{print}' data.csv").readsFiles).toBe(
      true,
    );
  });

  test("plain sed with no -i counts as a read", () => {
    // JUDGEMENT CALL: `sed 's/a/b/' file` streams the file to stdout, so
    // its content lands in the transcript exactly like `cat` would. That
    // is the behaviour this signal is about, so it counts as a read and
    // not as an edit.
    const classified = classifyTerminalCommand("sed 's/a/b/' f.ts");
    expect(classified.readsFiles).toBe(true);
    expect(classified.editsFiles).toBe(false);
  });

  test("a redirect target is not a read argument", () => {
    // `cat > SKILL.md <<EOF` writes SKILL.md. Counting the redirect
    // target as a `cat` argument would score a heredoc write as a read.
    const classified = classifyTerminalCommand(
      "cat > /workspace/skills/publish/SKILL.md << 'EOF'\nbody\nEOF",
    );
    expect(classified.readsFiles).toBe(false);
    expect(classified.editsFiles).toBe(true);
  });
});

describe("classifyTerminalCommand: edits", () => {
  test("in-place sed edits and does not count as a read", () => {
    // JUDGEMENT CALL: `sed -i` prints nothing back, so no file content
    // reaches the transcript. Edit only.
    const classified = classifyTerminalCommand("sed -i '' 's/a/b/' f.ts");
    expect(classified.editsFiles).toBe(true);
    expect(classified.readsFiles).toBe(false);
    // The GNU spelling attaches the suffix to the flag.
    expect(classifyTerminalCommand("sed -i.bak 's/a/b/' f.ts")).toEqual({
      readsFiles: false,
      editsFiles: true,
    });
  });

  test("tee in a pipeline edits its target", () => {
    expect(classifyTerminalCommand("bun run x | tee out.txt").editsFiles).toBe(
      true,
    );
  });

  test("redirection into a path edits", () => {
    expect(classifyTerminalCommand("echo hi > notes.md").editsFiles).toBe(true);
    // Append reads the left-hand file AND edits the right-hand one.
    expect(classifyTerminalCommand("cat a.ts >> b.ts")).toEqual({
      readsFiles: true,
      editsFiles: true,
    });
  });

  test("quoted redirection characters are not edits", () => {
    // The whole reason quoted spans are stripped before matching.
    expect(classifyTerminalCommand('echo "a > b"').editsFiles).toBe(false);
  });

  test("/dev/null and fd duplication are not edits", () => {
    // JUDGEMENT CALL: discarding output changes no file, and `2>&1` is
    // a descriptor redirect with no file target at all.
    expect(
      classifyTerminalCommand("bun test src > /dev/null 2>&1").editsFiles,
    ).toBe(false);
  });
});

describe("classifyTerminalCommand: neither", () => {
  test("running, searching, and listing are neither reads nor edits", () => {
    // JUDGEMENT CALL: `grep` returns matching lines rather than file
    // content, and is the search-first behaviour this signal exists to
    // contrast with, so it is not a terminal read. `ls` returns names,
    // not content. Network fetches are excluded because the run is
    // jailed and cannot make them.
    for (const command of [
      "bun test src",
      "grep -rn foo src/",
      "git status",
      "ls -la",
    ]) {
      expect(classifyTerminalCommand(command)).toEqual({
        readsFiles: false,
        editsFiles: false,
      });
    }
  });

  test("an empty command line classifies as neither", () => {
    expect(classifyTerminalCommand("   ")).toEqual({
      readsFiles: false,
      editsFiles: false,
    });
  });
});

describe("distinctFilePathsTouched", () => {
  test("counts one identity per file however the call spelled the path", () => {
    const paths = distinctFilePathsTouched([
      dispatched("file_read", { path: "/workspace/notes.md" }),
      direct("file_read", { path: "./notes.md" }),
      direct("file_edit", { path: "notes.md" }),
      direct("file_write", { file_path: "/workspace/out/report.md" }),
      // Not a file tool: a bash call naming a path does not count here.
      direct("bash", { command: "cat /workspace/other.md" }),
    ]);
    expect(paths).toEqual(["notes.md", "out/report.md"]);
  });

  test("an empty stream touches nothing", () => {
    expect(distinctFilePathsTouched([])).toEqual([]);
  });
});
