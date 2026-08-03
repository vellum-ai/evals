/**
 * Post-run inspection of a live Vellum assistant container.
 *
 * Metrics run *before* the runner shuts the agent down (see
 * `runner/run-once.ts`), so during scoring the assistant container —
 * named `<runId>-assistant` — is still up and can be probed with
 * `docker exec`. That lets artifact metrics assert on state the
 * transcript can't spoof: managed skills under `/workspace/skills/`,
 * schedules via the in-container `assistant` CLI, and workspace files
 * the agent produced.
 *
 * Everything here is Vellum-specific by design (the "Vellum artifacts"
 * grading decision for the procedure-reuse tests). Metrics using these
 * helpers must catch `AssistantContainerUnavailableError` and degrade to
 * an explanatory zero score for species that expose no such container.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { vellumDockerAssistantContainer } from "./egress/docker-jail";

const execFileAsync = promisify(execFile);

/** Workspace root inside the assistant container (`VELLUM_WORKSPACE_DIR`). */
export const ASSISTANT_WORKSPACE_DIR = "/workspace";

/** Where managed (catalog-installed and assistant-authored) skills live. */
export const ASSISTANT_SKILLS_DIR = `${ASSISTANT_WORKSPACE_DIR}/skills`;

/**
 * Raised when the assistant container can't be reached at all — it never
 * existed (non-vellum species), was already torn down, or docker itself
 * is unavailable. Distinct from a command that ran and exited non-zero.
 */
export class AssistantContainerUnavailableError extends Error {
  constructor(container: string, detail: string) {
    super(`assistant container ${container} is not inspectable: ${detail}`);
    this.name = "AssistantContainerUnavailableError";
  }
}

export interface ContainerExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a command inside the run's assistant container. Non-zero exits are
 * returned (a missing file is a signal, not an error); only "the
 * container itself is gone" becomes `AssistantContainerUnavailableError`.
 */
export async function execInAssistantContainer(
  runId: string,
  argv: string[],
): Promise<ContainerExecResult> {
  const container = vellumDockerAssistantContainer(runId);
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["exec", container, ...argv],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    return { exitCode: 0, stdout, stderr };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };
    const stderr = String(e.stderr ?? "");
    if (typeof e.code === "number") {
      if (/No such container|is not running/i.test(stderr)) {
        throw new AssistantContainerUnavailableError(container, stderr.trim());
      }
      return { exitCode: e.code, stdout: String(e.stdout ?? ""), stderr };
    }
    // Spawn-level failure (docker binary missing, etc.).
    throw new AssistantContainerUnavailableError(
      container,
      e.message ?? String(err),
    );
  }
}

/**
 * Read a UTF-8 file from the assistant's workspace, or `undefined` when
 * it doesn't exist. `relPath` is workspace-relative.
 */
export async function readAssistantWorkspaceFile(
  runId: string,
  relPath: string,
): Promise<string | undefined> {
  const result = await execInAssistantContainer(runId, [
    "cat",
    `${ASSISTANT_WORKSPACE_DIR}/${relPath}`,
  ]);
  return result.exitCode === 0 ? result.stdout : undefined;
}

/**
 * A managed skill directory as found under `/workspace/skills/`.
 * `installMeta` distinguishes assistant-authored skills (`origin:
 * "custom"`, `author: "assistant"`) from catalog installs (`origin:
 * "vellum"`); `files` are the companion files next to `SKILL.md`.
 */
export interface ManagedSkillInspection {
  id: string;
  dir: string;
  skillMd?: string;
  installMeta?: Record<string, unknown>;
  files: { path: string; content: string }[];
}

/** Companion files larger than this are listed but not fetched. */
const MAX_COMPANION_FETCH = 32;

/**
 * Enumerate managed skills in the run's assistant container, with their
 * `SKILL.md`, parsed `install-meta.json`, and companion file contents.
 */
export async function listManagedSkills(
  runId: string,
): Promise<ManagedSkillInspection[]> {
  const listing = await execInAssistantContainer(runId, [
    "sh",
    "-lc",
    `ls -1d ${ASSISTANT_SKILLS_DIR}/*/ 2>/dev/null`,
  ]);
  const dirs = listing.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const skills: ManagedSkillInspection[] = [];
  for (const dir of dirs) {
    const id = dir.replace(/\/+$/, "").split("/").pop() ?? dir;
    const skill: ManagedSkillInspection = { id, dir, files: [] };
    const skillMd = await execInAssistantContainer(runId, [
      "cat",
      `${dir.replace(/\/+$/, "")}/SKILL.md`,
    ]);
    if (skillMd.exitCode === 0) skill.skillMd = skillMd.stdout;
    const meta = await execInAssistantContainer(runId, [
      "cat",
      `${dir.replace(/\/+$/, "")}/install-meta.json`,
    ]);
    if (meta.exitCode === 0) {
      try {
        skill.installMeta = JSON.parse(meta.stdout) as Record<string, unknown>;
      } catch {
        // Unparseable meta is treated as absent.
      }
    }
    const find = await execInAssistantContainer(runId, [
      "sh",
      "-lc",
      `find '${dir.replace(/\/+$/, "")}' -type f ! -name SKILL.md ! -name install-meta.json 2>/dev/null`,
    ]);
    const companionPaths = find.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "")
      .slice(0, MAX_COMPANION_FETCH);
    for (const path of companionPaths) {
      const content = await execInAssistantContainer(runId, ["cat", path]);
      if (content.exitCode === 0) {
        skill.files.push({ path, content: content.stdout });
      }
    }
    skills.push(skill);
  }
  return skills;
}

/**
 * Enumerate schedules via the in-container `assistant` CLI (IPC to the
 * daemon, so the daemon must still be up — which it is during metrics).
 * `--all` includes deferred-wake rows so callers can filter explicitly.
 * Throws (beyond container-unavailable) when the CLI exits non-zero or
 * prints something unparseable, so metrics surface the real failure.
 */
export async function listAssistantSchedules(
  runId: string,
): Promise<Record<string, unknown>[]> {
  const result = await execInAssistantContainer(runId, [
    "assistant",
    "schedules",
    "list",
    "--all",
    "--json",
  ]);
  if (result.exitCode !== 0) {
    // A daemon that's down (CLI prints {"ok":false} and exits 1) means the
    // schedule surface isn't inspectable — same class as a missing
    // container, so use the error type every artifact metric already
    // degrades on instead of blowing up the metric run.
    throw new AssistantContainerUnavailableError(
      vellumDockerAssistantContainer(runId),
      `assistant schedules list failed (exit ${result.exitCode}): ${(result.stderr || result.stdout).trim().slice(0, 300)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `assistant schedules list printed unparseable JSON: ${result.stdout.slice(0, 200)}`,
    );
  }
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  if (parsed !== null && typeof parsed === "object") {
    for (const key of ["schedules", "jobs", "items"]) {
      const arr = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(arr)) return arr as Record<string, unknown>[];
    }
  }
  throw new Error(
    `assistant schedules list JSON had no schedule array: ${result.stdout.slice(0, 200)}`,
  );
}
