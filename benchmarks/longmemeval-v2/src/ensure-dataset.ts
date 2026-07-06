import { join } from "node:path";

import {
  downloadDataset,
  existsFile,
  relabelQuestions,
  LONGMEMEVAL_HF_REPO,
} from "./dataset-download";

export const AUTO_DOWNLOAD_ENV = "EVALS_DATA_AUTO_DOWNLOAD";

interface EnsureDeps {
  download: typeof downloadDataset;
  relabel: typeof relabelQuestions;
}

/**
 * Pod-only dataset bootstrap. When questions.jsonl is missing AND
 * EVALS_DATA_AUTO_DOWNLOAD=1, fetch + relabel the dataset before the
 * loader runs. Without the env var this is a strict no-op so local dev
 * keeps the loader's explicit "run data/download.ts" error. Safe on pod
 * retries: huggingface-cli hash-skips already-downloaded files and the
 * relabel transform is idempotent.
 */
export async function ensureDatasetAvailable(
  dataRoot: string,
  deps: EnsureDeps = { download: downloadDataset, relabel: relabelQuestions },
): Promise<void> {
  if (await existsFile(join(dataRoot, "questions.jsonl"))) return;
  if (process.env[AUTO_DOWNLOAD_ENV] !== "1") return;

  console.error(
    `[longmemeval-v2] questions.jsonl missing at ${dataRoot}; ` +
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
