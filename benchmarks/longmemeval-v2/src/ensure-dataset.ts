import { join } from "node:path";

import { pathExists } from "../../../src/lib/fs";
import {
  downloadDataset,
  relabelQuestions,
  LONGMEMEVAL_HF_REPO,
} from "./dataset-download";
import type { Tier } from "./loader";

export const AUTO_DOWNLOAD_ENV = "EVALS_DATA_AUTO_DOWNLOAD";

/**
 * Pod-only dataset bootstrap. The dataset counts as present only when
 * EVERY file the selected run consumes exists — questions.jsonl, the
 * selected tier's haystack mapping, and trajectories.jsonl. When any of
 * them is missing AND EVALS_DATA_AUTO_DOWNLOAD=1, fetch + relabel the
 * dataset before the loader runs. Without the env var this is a strict
 * no-op so local dev keeps the loader's explicit "run data/download.ts"
 * error.
 *
 * Three complementary self-heals make pod retries safe:
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
 * - When that fast-path relabel *throws* (torn/corrupt files — e.g. a
 *   half-written questions.jsonl or a haystack tier the selected run does
 *   not even use), fall back to the full download + relabel:
 *   huggingface-cli re-fetches hash-mismatched files, healing the tear.
 *   If the fallback also fails, the actionable wrapped error propagates —
 *   which correctly terminates the unhealable case where
 *   question-labels.json is absent from a custom dataRoot (it is committed
 *   to this repo, not part of the Hugging Face dataset, so no download can
 *   create it). Exception: when the fast-path relabel fails with
 *   EROFS/EACCES the dataRoot is read-only (an operator pre-staged it via
 *   EVALS_LONGMEMEVAL_DATA_ROOT) — a download into it is doomed, so skip
 *   the self-heal with a warning and let the loader's strict validation
 *   judge the pre-staged data as-is.
 *
 * Also safe on re-download: huggingface-cli resumes/hash-skips
 * already-downloaded files, and a re-download of hash-mismatched
 * relabeled files is safely re-relabeled.
 */
export async function ensureDatasetAvailable(
  dataRoot: string,
  tier: Tier,
): Promise<void> {
  if (process.env[AUTO_DOWNLOAD_ENV] !== "1") return;

  const requiredFiles = [
    "questions.jsonl",
    join("haystacks", `lme_v2_${tier}.json`),
    "trajectories.jsonl",
  ];
  const present: string[] = [];
  const missing: string[] = [];
  for (const file of requiredFiles) {
    if (await pathExists(join(dataRoot, file))) present.push(file);
    else missing.push(file);
  }

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
      await relabelQuestions(dataRoot);
    } catch (err) {
      // A read-only dataRoot (pre-staged mount) can't be relabeled — and a
      // download into it would be just as doomed, so don't attempt one.
      if (isReadOnlyFsError(err)) {
        console.error(
          "[longmemeval-v2] dataRoot is not writable; skipping relabel " +
            "self-heal — loader will validate the pre-staged data as-is.",
        );
        return;
      }
      // Otherwise a failing relabel over present files usually means a
      // torn/corrupt file (half-written questions.jsonl, or a haystack tier
      // this run doesn't even use). The download is resumable and re-fetches
      // hash-mismatched files, so fall back to the full bootstrap instead
      // of failing here. If the fallback fails too (e.g. the unhealable
      // missing-question-labels.json case), the wrapped error propagates.
      const cause = err instanceof Error ? err.message : String(err);
      console.error(
        `[longmemeval-v2] fast-path relabel failed (${cause}); ` +
          "attempting full download + relabel to heal potentially torn files…",
      );
      try {
        await downloadDataset({ dataRoot });
        await relabelQuestions(dataRoot);
      } catch (fallbackErr) {
        throw wrapBootstrapError(fallbackErr, dataRoot);
      }
      console.error(
        "[longmemeval-v2] fallback download + relabel complete — torn files healed.",
      );
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
    await downloadDataset({ dataRoot });
    await relabelQuestions(dataRoot);
  } catch (err) {
    throw wrapBootstrapError(err, dataRoot);
  }
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.error(
    `[longmemeval-v2] dataset download + relabel complete in ${elapsedSeconds}s.`,
  );
}

/**
 * True when the error (or anything in its `cause` chain) is a read-only /
 * permission filesystem failure — the signature of a pre-staged read-only
 * dataRoot rather than torn data.
 */
function isReadOnlyFsError(err: unknown): boolean {
  let current: unknown = err;
  while (current !== null && typeof current === "object") {
    const code = (current as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Actionable wrapper shared by the download and fast-path fallback failures. */
function wrapBootstrapError(err: unknown, dataRoot: string): Error {
  const cause = err instanceof Error ? err.message : String(err);
  return new Error(
    `LongMemEval-V2 dataset auto-download failed (repo ${LONGMEMEVAL_HF_REPO}, ` +
      `dataRoot ${dataRoot}): ${cause}. Retry the run, pre-stage the dataset ` +
      `with \`bun run data/download.ts\`, or unset ${AUTO_DOWNLOAD_ENV} to fail fast.`,
    { cause: err },
  );
}
