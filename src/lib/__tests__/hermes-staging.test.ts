import { describe, expect, test } from "bun:test";

import {
  HERMES_WORKSPACE_DIR,
  planHermesWorkspaceStaging,
} from "../adapters/hermes";
import { ASSISTANT_WORKSPACE_DIR } from "../vellum-artifacts";

/**
 * Regression pins for the Hermes `stage-workspace-file` staging policy —
 * the pure path-mapping + encoding rules `stageWorkspaceFile` executes
 * through Docker. The full docker-exec flow (mkdir as the hermes user,
 * stdin piping) is covered by `hermes-adapter.test.ts`; this file keeps
 * the policy itself testable without Docker per AGENTS.md.
 */
describe("planHermesWorkspaceStaging path mapping", () => {
  test("a bare filename lands directly under the workspace root", () => {
    const plan = planHermesWorkspaceStaging({ path: "restaurant-pnl.csv" });
    expect(plan.containerPath).toBe("/workspace/restaurant-pnl.csv");
    expect(plan.containerParent).toBe("/workspace");
  });

  test("a nested path keeps its directories under the workspace root", () => {
    const plan = planHermesWorkspaceStaging({ path: "manifests/box-a.csv" });
    expect(plan.containerPath).toBe("/workspace/manifests/box-a.csv");
    expect(plan.containerParent).toBe("/workspace/manifests");
  });

  test("the workspace root matches the Vellum adapter's, so one SPEC path works across species", () => {
    // Cross-species contract: a SPEC that tells the agent "the user
    // uploaded manifests/box-a.csv to /workspace" must be true on both
    // species. Vellum's post-run introspection constant is the canonical
    // spelling of that root.
    expect(HERMES_WORKSPACE_DIR).toBe(ASSISTANT_WORKSPACE_DIR);
  });
});

describe("planHermesWorkspaceStaging encoding handling", () => {
  test("utf8 (default) writes stdin straight to the target path, argv-only", () => {
    const plan = planHermesWorkspaceStaging({ path: "notes.md" });
    expect(plan.writeArgv).toEqual(["cp", "/dev/stdin", "/workspace/notes.md"]);
  });

  test("explicit utf8 is identical to the default", () => {
    expect(
      planHermesWorkspaceStaging({ path: "notes.md", encoding: "utf8" }),
    ).toEqual(planHermesWorkspaceStaging({ path: "notes.md" }));
  });

  test("base64 decodes inside the container with the path as a positional parameter", () => {
    const plan = planHermesWorkspaceStaging({
      path: "IMG_0821.png",
      encoding: "base64",
    });
    // The payload stays base64 text on stdin (the runner's stdin contract
    // is UTF-8) and decodes to raw bytes in-container. The path rides as
    // "$1", never interpolated into the shell script.
    expect(plan.writeArgv).toEqual([
      "sh",
      "-c",
      'base64 -d > "$1"',
      "sh",
      "/workspace/IMG_0821.png",
    ]);
  });
});

describe("planHermesWorkspaceStaging path safety", () => {
  test("rejects absolute paths", () => {
    expect(() => planHermesWorkspaceStaging({ path: "/etc/passwd" })).toThrow(
      /workspace-relative/,
    );
  });

  test("rejects .. traversal out of the workspace root", () => {
    expect(() =>
      planHermesWorkspaceStaging({ path: "../opt/data/state.db" }),
    ).toThrow(/escape the workspace root/);
    expect(() =>
      planHermesWorkspaceStaging({ path: "manifests/../../escape.txt" }),
    ).toThrow(/escape the workspace root/);
  });

  test("rejects the empty path", () => {
    expect(() => planHermesWorkspaceStaging({ path: "" })).toThrow(/non-empty/);
  });
});
