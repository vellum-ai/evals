import { join } from "node:path";

import {
  downloadDataset,
  existsFile,
  relabelQuestions,
  LONGMEMEVAL_HF_REPO,
} from "./dataset-download";
import type { Tier } from "./loader";

export const AUTO_DOWNLOAD_ENV = "EVALS_DATA_AUTO_DOWNLOAD";

interface EnsureDeps {
  download: typeof downloadDataset;
  relabel: typeof relabelQuestions;
}

/**
 * Pod-only dataset bootstrap. The dataset counts as present only when
 * EVERY file the selected run consumes exists — questions.jsonl, the
 * selected tier's haystack mapping, and trajectories.jsonl. When any of
 * them is missing AND EVALS_DATA_AUTO_DOWNLOAD=1, fetch + relabel the
 * dataset before the loader runs. Without the env var this is a strict
 * no-op so local dev keeps the loader's explicit "run data/download.ts"
 * error.
 *
 * The completeness check is what makes interrupted-download retries
 * self-heal: a partial download can leave questions.jsonl on disk while
 * the haystack and/or the large trajectories.jsonl are still missing, and
 * a bare questions.jsonl check would skip the retry and fall through to
 * loader / trajectory-reader ENOENT errors. Safe on pod retries:
 * huggingface-cli resumes/hash-skips already-downloaded files, the
 * relabel transform is idempotent, and a re-download of hash-mismatched
 * relabeled files is safely re-relabeled.
 */
export async function ensureDatasetAvailable(
  dataRoot: string,
  tier: Tier,
  deps: EnsureDeps = { download: downloadDataset, relabel: relabelQuestions },
): Promise<void> {
  const requiredFiles = [
    "questions.jsonl",
    join("haystacks", `lme_v2_${tier}.json`),
    "trajectories.jsonl",
  ];
  const present: string[] = [];
  const missing: string[] = [];
  for (const file of requiredFiles) {
    if (await existsFile(join(dataRoot, file))) present.push(file);
    else missing.push(file);
  }
  if (missing.length === 0) return;
  if (process.env[AUTO_DOWNLOAD_ENV] !== "1") return;

  const why =
    present.length > 0
      ? `${present.join(", ")} present but ${missing.join(", ")} missing — resuming download`
      : `${missing.join(", ")} missing at ${dataRoot}`;
  console.error(
    `[longmemeval-v2] ${why}; ` +
      `${AUTO_DOWNLOAD_ENV}=1 — downloading dataset from ` +
      `${LONGMEMEVAL_HF_REPO} (~7.12 GB, may take minutes)…`,
  );
  const startedAt = Date.now();
  try {
    await deps.download({ dataRoot });
    await deps.relabel(dataRoot);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `LongMemEval-V2 dataset auto-download failed (repo ${LONGMEMEVAL_HF_REPO}, ` +
        `dataRoot ${dataRoot}): ${cause}. Retry the run, pre-stage the dataset ` +
        `with \`bun run data/download.ts\`, or unset ${AUTO_DOWNLOAD_ENV} to fail fast.`,
      { cause: err },
    );
  }
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.error(
    `[longmemeval-v2] dataset download + relabel complete in ${elapsedSeconds}s.`,
  );
}
