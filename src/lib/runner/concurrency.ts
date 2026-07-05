/**
 * Bounded-concurrency task runner.
 *
 * `runWithConcurrency(tasks, workers)` executes an array of thunks
 * (each returning a Promise) with at most `workers` in flight at once.
 * Used by benchmark `run()` modules to parallelize the profile x unit
 * Cartesian loop behind `--workers N`.
 *
 * Ordering: tasks start in array order (subject to the concurrency
 * limit) but complete whenever they finish — the caller is responsible
 * for any ordering invariants via the task closure. Errors in one
 * task never short-circuit the others: every task runs to completion,
 * and `allSettled` results are returned so the caller can classify
 * failures.
 */

export interface ConcurrencyResult<T> {
  /** Results in the same order as `tasks`, mirroring `Promise.allSettled`. */
  settled: PromiseSettledResult<T>[];
  /** True if any task rejected. */
  anyFailed: boolean;
}

/**
 * Run `tasks` with at most `workers` concurrent. Each entry is a
 * zero-arg function (`() => Promise<T>`) so the caller controls when
 * the work starts — we only begin a thunk when a worker slot opens.
 *
 * `workers <= 0` (or non-integer) falls back to sequential execution
 * (`workers = 1`) so a misconfigured `--workers 0` is a safe no-op
 * rather than a deadlock.
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  workers: number,
): Promise<ConcurrencyResult<T>> {
  const n = Number.isInteger(workers) && workers > 0 ? workers : 1;
  if (n === 1 || tasks.length <= 1) {
    const settled: PromiseSettledResult<T>[] = [];
    let anyFailed = false;
    for (const task of tasks) {
      try {
        const value = await task();
        settled.push({ status: "fulfilled", value });
      } catch (reason) {
        settled.push({ status: "rejected", reason });
        anyFailed = true;
      }
    }
    return { settled, anyFailed };
  }

  // Semaphore-based bounded concurrency: an array of indices tracks
  // which tasks have been dispatched, and a pool of `n` workers each
  // pull the next available index. This avoids materializing all
  // promises up front (which would start every task immediately).
  const settled: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;
  let anyFailed = false;

  async function worker(): Promise<void> {
    while (true) {
      const myIndex = nextIndex++;
      if (myIndex >= tasks.length) return;
      try {
        const value = await tasks[myIndex]!();
        settled[myIndex] = { status: "fulfilled", value };
      } catch (reason) {
        settled[myIndex] = { status: "rejected", reason };
        anyFailed = true;
      }
    }
  }

  const pool = Array.from({ length: Math.min(n, tasks.length) }, () =>
    worker(),
  );
  await Promise.all(pool);
  return { settled, anyFailed };
}
