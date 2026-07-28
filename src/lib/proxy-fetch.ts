/**
 * A `fetch` shim that survives the TLS-re-terminating egress proxies used
 * by sandboxed CI / agent environments.
 *
 * Bun's built-in `fetch` (through at least 1.3.x) resets the socket when it
 * reaches an **HTTP/2** origin through an HTTPS `CONNECT` proxy tunnel: the
 * TCP relay succeeds but the tunneled h2/TLS session is torn down with
 * `ECONNRESET`. The agent proxy in these environments is exactly that shape
 * (a local `CONNECT` proxy that re-terminates TLS with a private CA), and
 * `qa.vellum.ai` serves HTTP/2 — so every launcher call from inside such a
 * sandbox fails even though the auth token, CA trust, and endpoint are all
 * fine. Bun reaches HTTP/1.1 origins through the same proxy without trouble,
 * which is what pins the cause to h2-over-tunnel rather than the proxy or
 * policy. `curl` handles h2-over-tunnel correctly.
 *
 * Strategy: when an HTTPS proxy is configured in the environment, route the
 * request through `curl` (which honors the proxy and negotiates h2 through
 * the tunnel correctly); otherwise, and whenever `curl` is unavailable, fall
 * back to native `fetch` so behavior on a normal developer machine — where
 * there is no such proxy — is completely unchanged.
 */

/** Read the configured HTTPS proxy URL, trimmed; `undefined` when unset. */
export function resolveHttpsProxy(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const raw = env.HTTPS_PROXY ?? env.https_proxy;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

/** Flatten `HeadersInit` into a plain `Record<string, string>`. */
function normalizeHeaders(init?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) return out;
  if (init instanceof Headers) {
    init.forEach((v, k) => {
      out[k] = v;
    });
  } else if (Array.isArray(init)) {
    for (const [k, v] of init) out[k] = v;
  } else {
    for (const [k, v] of Object.entries(init)) out[k] = v as string;
  }
  return out;
}

/**
 * Perform an HTTP request via `curl` through the given proxy, returning a
 * standard `Response` so callers are identical to the `fetch` path. Throws
 * (like `fetch`) on transport failure; falls back to native `fetch` when the
 * `curl` binary cannot be spawned.
 */
async function curlFetch(
  url: string,
  init: RequestInit,
  proxy: string,
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = normalizeHeaders(init.headers);
  const body = typeof init.body === "string" ? init.body : undefined;

  // `-w` appends the status after the body on stdout; a distinctive marker
  // lets us split it back off even when the body itself contains newlines.
  const STATUS_MARKER = "\n__EVALS_HTTP_STATUS__:";
  const args = ["--silent", "--show-error", "--proxy", proxy, "-X", method];
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  if (body !== undefined) args.push("--data-binary", "@-");
  args.push("-w", `${STATUS_MARKER}%{http_code}`, url);

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(["curl", ...args], {
      stdin: body !== undefined ? new TextEncoder().encode(body) : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch {
    // curl is not available — fall back to native fetch unchanged.
    return fetch(url, init);
  }

  const [out, err, code] = await Promise.all([
    new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
    new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
    proc.exited,
  ]);

  const idx = out.lastIndexOf(STATUS_MARKER);
  if (idx === -1) {
    const detail = err.trim() || `exit ${code}`;
    throw new Error(`curl request to ${url} failed: ${detail}`);
  }

  const status = Number(out.slice(idx + STATUS_MARKER.length).trim());
  if (!Number.isFinite(status) || status < 100) {
    const detail = err.trim() || `exit ${code}`;
    throw new Error(
      `curl request to ${url} produced no HTTP response: ${detail}`,
    );
  }

  return new Response(out.slice(0, idx), { status });
}

/**
 * Drop-in `fetch` that routes through `curl` when an HTTPS proxy is present
 * in `env`, and uses native `fetch` otherwise.
 */
export async function proxyAwareFetch(
  url: string,
  init: RequestInit = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> {
  const proxy = resolveHttpsProxy(env);
  if (!proxy) return fetch(url, init);
  return curlFetch(url, init, proxy);
}
