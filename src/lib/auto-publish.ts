/**
 * Post-run auto-publish of the session bundle to the QA dashboard.
 *
 * Gated on the same launcher env as live run events: with
 * `EVAL_RESULTS_UPLOAD_URL` unset the run behaves byte-identically to a
 * plain local run. This module NEVER throws — publishing is a delivery
 * concern layered on top of a finished eval, so each outcome is reported
 * as a status the caller can map to an exit-code policy.
 */
import { pushBundleToUrl } from "./bundle-push";

export type AutoPublishResult =
  | "disabled"
  | "skipped-no-token"
  | "published"
  | "failed";

/**
 * Publish the session bundle when the launcher env asks for it.
 *
 * - `EVAL_RESULTS_UPLOAD_URL` unset/whitespace → `"disabled"`, silently.
 * - URL set but `QA_AUTH_TOKEN` unset/whitespace → loud warning (the
 *   results will never reach the dashboard) → `"skipped-no-token"`.
 * - Both set → push the bundle; `"published"` on success (pushBundleToUrl
 *   already logs the view URL), `"failed"` + console.error on any throw.
 */
export async function autoPublishSession(input: {
  sessionId: string;
  env?: NodeJS.ProcessEnv;
  push?: typeof pushBundleToUrl;
}): Promise<AutoPublishResult> {
  const env = input.env ?? process.env;
  const push = input.push ?? pushBundleToUrl;

  const baseUrl = env.EVAL_RESULTS_UPLOAD_URL?.trim();
  if (!baseUrl) return "disabled";

  const authToken = env.QA_AUTH_TOKEN?.trim();
  if (!authToken) {
    console.warn(
      "[evals] EVAL_RESULTS_UPLOAD_URL is set but QA_AUTH_TOKEN is missing — " +
        "skipping bundle publish;\n" +
        `[evals] results for session ${input.sessionId} will NOT appear on the dashboard.\n` +
        "[evals] Set QA_AUTH_TOKEN (or run `evals export --out <url>` manually) to publish.",
    );
    return "skipped-no-token";
  }

  try {
    // Pass the trimmed URL through as-is (pushBundleToUrl normalizes
    // trailing slashes internally) and the token explicitly so this
    // function doesn't silently re-read env.
    await push(input.sessionId, baseUrl, { authToken });
    return "published";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[evals] bundle publish failed for session ${input.sessionId}: ${message}`,
    );
    return "failed";
  }
}
