/**
 * Library functions for fetching the LongMemEval-V2 dataset from Hugging
 * Face and relabeling question IDs to the human-readable keys defined in
 * `question-labels.json`. Consumed by the `data/download.ts` CLI wrapper
 * and by programmatic callers (e.g. dataset auto-download).
 *
 * Informational progress lines go to stderr so stdout stays reserved for
 * command output.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pathExists } from "../../../src/lib/fs";

export const LONGMEMEVAL_HF_REPO = "xiaowu0162/longmemeval-v2";

// Pinned <1.0: huggingface_hub 1.x replaces `huggingface-cli` with a stub
// that exits 1, so an unpinned install reproduces the failure.
const INSTALL_HINT =
  'Install it with: pip install -U "huggingface_hub[cli]<1.0"';

/**
 * Fetch the raw dataset from Hugging Face into dataRoot. Idempotent:
 * huggingface-cli hash-skips files that are already present. Throws on
 * a missing binary or non-zero exit.
 */
export async function downloadDataset(opts: {
  dataRoot: string;
  repo?: string; // default LONGMEMEVAL_HF_REPO
}): Promise<void> {
  const repo = opts.repo ?? LONGMEMEVAL_HF_REPO;
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn({
      cmd: [
        "huggingface-cli",
        "download",
        repo,
        "--repo-type",
        "dataset",
        "--local-dir",
        opts.dataRoot,
      ],
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch {
    // Bun.spawn throws when the binary is not on PATH (ENOENT).
    throw new Error(
      `huggingface-cli not found while downloading ${repo}. ${INSTALL_HINT}`,
    );
  }
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(
      `huggingface-cli exited with ${exitCode} while downloading ${repo}. ${INSTALL_HINT}`,
    );
  }
}

/**
 * Relabel question IDs in questions.jsonl and re-key both haystack tiers
 * using the mapping in question-labels.json. Overwrites the raw downloaded
 * files in place — the original hex IDs are preserved as a field in each
 * question record so the mapping is always recoverable. Pure fs transform,
 * idempotent. Throws if question-labels.json or questions.jsonl is missing.
 */
export async function relabelQuestions(dataRoot: string): Promise<void> {
  const labelsPath = join(dataRoot, "question-labels.json");
  if (!(await pathExists(labelsPath))) {
    throw new Error(`question-labels.json not found at ${labelsPath}`);
  }

  const labels: Record<string, string> = JSON.parse(
    await readFile(labelsPath, "utf8"),
  );
  console.error(`Loaded ${Object.keys(labels).length} human-readable labels`);

  // --- Relabel questions.jsonl ---
  const questionsPath = join(dataRoot, "questions.jsonl");
  if (!(await pathExists(questionsPath))) {
    throw new Error(`questions.jsonl not found at ${questionsPath}`);
  }

  const questionsRaw = await readFile(questionsPath, "utf8");
  const lines = questionsRaw.split("\n").filter((l) => l.trim() !== "");
  let relabeled = 0;
  let missing = 0;

  const outLines = lines.map((line) => {
    const q = JSON.parse(line) as Record<string, unknown>;
    const oldId = q.id as string;
    const newId = labels[oldId];
    if (!newId) {
      missing++;
      return line;
    }
    // Preserve the original ID as a field for traceability.
    q.originalId = oldId;
    q.id = newId;
    relabeled++;
    return JSON.stringify(q);
  });

  await writeFile(questionsPath, outLines.join("\n") + "\n");
  console.error(
    `Relabeled ${relabeled} questions (${missing} without a label)`,
  );

  // --- Re-key haystack files ---
  for (const tier of ["small", "medium"] as const) {
    const haystackPath = join(dataRoot, "haystacks", `lme_v2_${tier}.json`);
    if (!(await pathExists(haystackPath))) {
      console.error(`Skipping ${tier} haystack (not present)`);
      continue;
    }

    const haystack: Record<string, string[]> = JSON.parse(
      await readFile(haystackPath, "utf8"),
    );
    const rekeyed: Record<string, string[]> = {};
    let rekeyedCount = 0;

    for (const [oldId, trajIds] of Object.entries(haystack)) {
      const newId = labels[oldId];
      if (newId) {
        rekeyed[newId] = trajIds;
        rekeyedCount++;
      } else {
        // Keep unmapped entries under their original ID.
        rekeyed[oldId] = trajIds;
      }
    }

    await writeFile(haystackPath, JSON.stringify(rekeyed, null, 2) + "\n");
    console.error(`Re-keyed ${rekeyedCount} ${tier} haystack entries`);
  }
}
