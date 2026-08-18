/**
 * What the assistant under test was built from.
 *
 * A run's whole meaning can hinge on which commit of the parent repo the
 * images came out of — a baseline-versus-fix comparison is two runs that
 * differ in nothing else. `EVALS_ASSISTANT_SOURCE` makes that switch a
 * shell variable, which is easy to set and impossible to see afterwards:
 * the run artifacts recorded the CLI argv and the profile, and nothing
 * about the tree the assistant was compiled from.
 *
 * So record it. Path, commit, subject line, and whether the tree had
 * uncommitted changes when the run started — enough for a reader months
 * later to say "this run is the pre-fix build" without taking anyone's
 * word for it.
 *
 * Vellum-only: it is the species the harness builds from source. Other
 * species run a published binary and have nothing to describe.
 */

import { resolve } from "node:path";

/** The tree an assistant was built from, as recorded on a run. */
export interface AssistantSourceRecord {
  /** Absolute path to the checkout or worktree. */
  path: string;
  /** Full commit sha, when the path is a git checkout. */
  commit?: string;
  /** That commit's subject line, so a reader need not look it up. */
  subject?: string;
  /**
   * Whether the tree carried uncommitted changes. A dirty tree means the
   * commit alone does not describe what ran.
   */
  dirty?: boolean;
}

function git(cwd: string, args: string[]): string | undefined {
  try {
    const result = Bun.spawnSync(["git", "-C", cwd, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) return undefined;
    const text = result.stdout.toString().trim();
    return text === "" ? undefined : text;
  } catch {
    // No git, or no repository. The path is still worth recording.
    return undefined;
  }
}

/**
 * Describe the source tree at `sourcePath`.
 *
 * Never throws: a run must not fail because its provenance could not be
 * read. A path that is not a git checkout records the path alone, which
 * is still more than the artifacts carried before.
 */
export function describeAssistantSource(
  sourcePath: string,
): AssistantSourceRecord {
  const path = resolve(sourcePath);
  const commit = git(path, ["rev-parse", "HEAD"]);
  if (commit === undefined) return { path };
  return {
    path,
    commit,
    subject: git(path, ["log", "-1", "--format=%s"]),
    // `git()` returns undefined for empty output, and a clean tree
    // prints nothing — so "no output" is exactly "no local changes".
    dirty: git(path, ["status", "--porcelain"]) !== undefined,
  };
}
