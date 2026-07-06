/** Shared test doubles used across `src/lib/__tests__` suites. */

/**
 * A fetch stub simulating a dead endpoint: every call hangs until its
 * AbortSignal fires. The timer behind AbortSignal.timeout() is unref'd, so
 * if the pending promise were the only work, Bun could exit the event loop
 * without ever firing it and the caller would hang. A real (ref'd)
 * setTimeout keeps the loop alive long enough for the abort to fire, and
 * doubles as a fallback rejection so a test can never hang.
 */
export function hangingFetch(timeoutMs: number): {
  seenSignals: Array<AbortSignal | null | undefined>;
  fetchImpl: typeof fetch;
} {
  const seenSignals: Array<AbortSignal | null | undefined> = [];
  const fetchImpl = ((_input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      seenSignals.push(init?.signal);
      const fallback = setTimeout(() => {
        reject(new Error("fake fetch: abort never fired"));
      }, timeoutMs + 200);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(fallback);
        reject(init.signal?.reason ?? new Error("aborted"));
      });
    })) as typeof fetch;
  return { seenSignals, fetchImpl };
}
