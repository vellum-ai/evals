/**
 * Fetch the LongMemEval-V2 dataset from Hugging Face and relabel question
 * IDs to human-readable keys defined in `question-labels.json`.
 *
 * The dataset is ~7.12 GB and stays gitignored. This script is idempotent:
 * huggingface-cli skips already-downloaded files (compares by hash), and
 * the relabel step is a pure transform that overwrites in place.
 *
 * Usage:
 *   bun run data/download.ts                  # download + relabel
 *   bun run data/download.ts --no-download    # relabel only (data already present)
 *   DATA_ROOT=/path bun run data/download.ts  # custom output dir
 *
 * Requires: huggingface-cli (`pip install -U "huggingface_hub[cli]<1.0"`;
 * huggingface_hub 1.x replaces `huggingface-cli` with a stub that exits 1).
 */
import { readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

import { downloadDataset, relabelQuestions } from "../src/dataset-download";

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const DATA_ROOT = resolve(process.env.DATA_ROOT ?? SCRIPT_DIR);
const NO_DOWNLOAD = process.argv.includes("--no-download");

try {
  if (!NO_DOWNLOAD) {
    await downloadDataset({ dataRoot: DATA_ROOT, repo: process.env.REPO });
  }

  await relabelQuestions(DATA_ROOT);
  console.log("\nDone. Top-level files:");
  const entries = await readdir(DATA_ROOT);
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    console.log(`  ${name}`);
  }

  console.log(`
The loader (src/loader.ts) reads:
  - questions.jsonl (relabeled with human-readable IDs)
  - haystacks/lme_v2_{small,medium}.json (re-keyed to match)

trajectories.jsonl and *_screenshots/ are consumed by the runner, not the loader.
`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
