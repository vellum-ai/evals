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
 * Two complementary self-heals make pod retries safe:
 *
 * - The file-completeness check heals a kill *during download*: a partial
 *   download can leave questions.jsonl on disk while the haystack and/or
 *   the large trajectories.jsonl are still missing, and a bare
 *   questions.jsonl check would skip the retry and fall through to
 *   loader / trajectory-reader ENOENT errors.
 * - Re-running relabel on the all-files-present fast path heals a kill
 *   *during relabel*: a prior attempt may have rewritten questions.jsonl
 *   but died before re-keying the haystack JSONs, leaving relabeled
 *   question ids against raw haystack keys. The relabel transform is a
 *   cheap, idempotent, local pass over questions.jsonl + the haystack
 *   JSONs (it never touches the ~7 GB trajectories.jsonl):
 *   already-relabeled ids miss the label map and pass through, raw ids
 *   get relabeled.
 *
 * Also safe on re-download: huggingface-cli resumes/hash-skips
 * already-downloaded files, and a re-download of hash-mismatched
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
  if (process.env[AUTO_DOWNLOAD_ENV] !== "1") return;

  if (missing.length === 0) {
    // Everything is on disk, so skip the download — but a previous pod
    // attempt may have been killed mid-relabel (questions.jsonl rewritten,
    // haystacks not yet re-keyed). Relabel is idempotent and cheap, so
    // always re-run it here to heal that torn state.
    console.error(
      "[longmemeval-v2] dataset present — running idempotent relabel to " +
        "heal any interrupted prior bootstrap.",
    );
    try {
      await deps.relabel(dataRoot);
    } catch (err) {
      throw wrapBootstrapError(err, dataRoot);
    }
    return;
  }

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
    throw wrapBootstrapError(err, dataRoot);
  }
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.error(
    `[longmemeval-v2] dataset download + relabel complete in ${elapsedSeconds}s.`,
  );
}

/** Actionable wrapper shared by the download and fast-path relabel failures. */
function wrapBootstrapError(err: unknown, dataRoot: string): Error {
  const cause = err instanceof Error ? err.message : String(err);
  return new Error(
    `LongMemEval-V2 dataset auto-download failed (repo ${LONGMEMEVAL_HF_REPO}, ` +
      `dataRoot ${dataRoot}): ${cause}. Retry the run, pre-stage the dataset ` +
      `with \`bun run data/download.ts\`, or unset ${AUTO_DOWNLOAD_ENV} to fail fast.`,
    { cause: err },
  );
}
