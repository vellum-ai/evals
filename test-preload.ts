/**
 * Bun test preload (wired via `bunfig.toml` `[test] preload`).
 *
 * Points `RUNS_DIR` (src/lib/metrics.ts) at a per-invocation tempdir so
 * the suite's run-artifact fixtures never touch the production `.runs/`
 * directory. Before this, `bun test` wrote its fixtures into the real
 * `.runs/` and could disturb (and in observed cases, delete) genuine run
 * artifacts sitting there.
 *
 * Must run before any module reads `RUNS_DIR`, which is captured at
 * module-init — hence a preload rather than a per-file beforeAll.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.EVALS_RUNS_DIR ??= mkdtempSync(join(tmpdir(), "evals-test-runs-"));
