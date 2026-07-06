/**
 * Push a report-session bundle to a QA dashboard's upload endpoint.
 *
 * Shared by `evals export --out https://...` and the post-run auto-publish
 * path, so it lives in the lib layer with no CLI imports.
 */
import { buildBundleBuffer, buildRunBundle } from "./report-bundle";

/**
 * Builds a session bundle and POSTs it to a QA dashboard's upload endpoint.
 * The `outUrl` (e.g. `https://qa.vellum.ai`) is resolved to
 * `<origin>/api/evals/upload`. Auth uses `opts.authToken`, defaulting to the
 * `QA_AUTH_TOKEN` env var, as a Bearer token.
 *
 * Returns the server-assigned run id and the URL where the pushed run is
 * viewable.
 *
 * The upload is bounded by `opts.timeoutMs` (default 2 minutes — bundles can
 * be large) so a hung endpoint fails the push instead of stalling forever.
 */
export async function pushBundleToUrl(
  sessionId: string,
  outUrl: string,
  opts?: { authToken?: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<{ runId: string; viewUrl: string }> {
  const authToken = opts?.authToken ?? process.env.QA_AUTH_TOKEN;
  if (!authToken) {
    throw new Error(
      "QA_AUTH_TOKEN is not set — export to a file instead, or set the " +
        "token env var to push directly to the QA dashboard.",
    );
  }
  const fetchImpl = opts?.fetchImpl ?? globalThis.fetch;

  const base = outUrl.replace(/\/+$/, "");
  const uploadUrl = `${base}/api/evals/upload`;

  console.log(`Bundling session ${sessionId}…`);
  const files = await buildRunBundle(sessionId);
  const buffer = await buildBundleBuffer(files);
  console.log(`Built bundle (${files.length} files, ${buffer.length} bytes)`);

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/gzip" }),
    "bundle.tar.gz",
  );

  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}` },
    body: formData,
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 120_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Upload failed (${response.status} ${response.statusText}): ${body}`,
    );
  }

  const result = (await response.json()) as { id?: string; sessionId?: string };
  const runId = result.id ?? result.sessionId ?? sessionId;
  const viewUrl = `${base}/evals/runs/${runId}`;
  console.log(`Pushed session ${sessionId} → ${outUrl} (run id: ${runId})`);
  console.log(`View at: ${viewUrl}`);
  return { runId, viewUrl };
}
