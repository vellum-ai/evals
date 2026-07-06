/**
 * Small shared filesystem helpers.
 */
import { stat } from "node:fs/promises";

/**
 * True when `path` exists (file or directory). Swallows ONLY ENOENT —
 * any other stat failure (EACCES, EIO, …) rethrows, so a permission or
 * I/O error is never silently reported as "missing". Callers that gate
 * expensive work (e.g. a dataset download) on absence rely on that.
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}
