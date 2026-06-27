import type { AgentEvent } from "../adapter";

const TIMEOUT = Symbol("timeout");

type PendingNext = Promise<IteratorResult<AgentEvent>>;

function timeout(ms: number): Promise<typeof TIMEOUT> {
  return new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), ms));
}

export class AgentEventCollector {
  private pending?: PendingNext;

  constructor(private readonly iterator: AsyncIterator<AgentEvent>) {}

  private next(): PendingNext {
    this.pending ??= this.iterator.next();
    return this.pending;
  }

  /**
   * Drain events until the stream ends, the stream goes quiet for
   * `quietMs`, or the `maxMs` hard cap elapses — whichever comes first.
   * Each event resets the quiet timer, so an actively-streaming turn runs
   * up to `maxMs`. Shared by both public collectors.
   */
  private async drain(input: {
    quietMs: number;
    maxMs: number;
    onEvent?: (event: AgentEvent) => void | Promise<void>;
  }): Promise<AgentEvent[]> {
    const { quietMs, maxMs, onEvent } = input;
    const events: AgentEvent[] = [];
    const hardDeadline = Date.now() + maxMs;
    let quietDeadline = Date.now() + quietMs;

    while (Date.now() < hardDeadline) {
      const waitMs = Math.max(
        0,
        Math.min(quietDeadline, hardDeadline) - Date.now(),
      );
      if (waitMs === 0) break;

      const result = await Promise.race([this.next(), timeout(waitMs)]);
      if (result === TIMEOUT) break;

      this.pending = undefined;
      if (result.done) break;

      events.push(result.value);
      // Let the caller react to the event (e.g. approve a pending tool
      // confirmation) before resetting the quiet timer, so the reaction's
      // latency doesn't count against the quiet window — and so the next
      // event, which the daemon only emits once the reaction unblocks the
      // turn, still gets a full window to arrive.
      if (onEvent) await onEvent(result.value);
      quietDeadline = Date.now() + quietMs;
    }

    return events;
  }

  async collectUntilQuiet(input: {
    quietMs: number;
    maxMs?: number;
    onEvent?: (event: AgentEvent) => void | Promise<void>;
  }): Promise<AgentEvent[]> {
    const quietMs = input.quietMs;
    const maxMs = input.maxMs ?? Math.max(quietMs * 6, quietMs);
    return this.drain({ quietMs, maxMs, onEvent: input.onEvent });
  }

  /**
   * Like `collectUntilQuiet`, but reports whether the turn completed via
   * an explicit completion signal (the sentinel) rather than treating
   * "events stopped arriving" as success.
   *
   * Events are collected until `isDone` returns `true` against the
   * accumulated event list, or the `maxMs` hard cap elapses. Once the
   * sentinel is seen, trailing events (e.g. `message_complete`,
   * `assistant_usage`) are drained with a short `graceQuietMs` window
   * (default 5s) so cost-accounting events are captured without waiting
   * the full `quietMs` (e.g. 120s). This cuts the ingest-to-question
   * gap from ~120s to ~5s on a typical run.
   *
   * `isDone` is evaluated against the full captured event list after
   * each event arrives, keeping content semantics (what counts as the
   * sentinel) out of the collector. A `false` result means the stream
   * went quiet or hit the hard cap without ever signalling completion
   * (a truncated or stalled ingest), letting the caller fail loudly
   * instead of grading it.
   */
  async collectUntilSentinel(input: {
    isDone: (events: readonly AgentEvent[]) => boolean;
    maxMs: number;
    quietMs: number;
    /** Grace period after sentinel to capture trailing events. Default 5s. */
    graceQuietMs?: number;
    onEvent?: (event: AgentEvent) => void | Promise<void>;
  }): Promise<{ events: AgentEvent[]; sentinelSeen: boolean }> {
    const graceQuietMs = input.graceQuietMs ?? 5_000;
    const hardDeadline = Date.now() + input.maxMs;
    const events: AgentEvent[] = [];
    let sentinelSeen = false;

    // Phase 1: collect events until the sentinel appears, the inter-event
    // gap exceeds `quietMs` (a stalled turn), or the hard cap elapses.
    // Unlike collectUntilQuiet there is no quiet window *after* the
    // sentinel — the sentinel short-circuits immediately. But `quietMs`
    // still serves as an inter-event safety net: if no event arrives
    // within `quietMs` and the sentinel hasn't been seen, the turn is
    // stalled and we stop rather than waiting the full `maxMs`.
    let quietDeadline = Date.now() + input.quietMs;
    while (!sentinelSeen) {
      const waitMs = Math.max(
        0,
        Math.min(quietDeadline, hardDeadline) - Date.now(),
      );
      if (waitMs <= 0) break;

      const result = await Promise.race([this.next(), timeout(waitMs)]);
      if (result === TIMEOUT) break;

      this.pending = undefined;
      if (result.done) break;

      events.push(result.value);
      if (input.onEvent) await input.onEvent(result.value);
      sentinelSeen = input.isDone(events);
      quietDeadline = Date.now() + input.quietMs;
    }

    // Phase 2: drain trailing events (message_complete, usage records,
    // sync notifications) with a short grace window so they're captured
    // for cost accounting without waiting the full quietMs.
    if (sentinelSeen) {
      const trailing = await this.drain({
        quietMs: graceQuietMs,
        maxMs: Math.max(0, hardDeadline - Date.now()),
        onEvent: input.onEvent,
      });
      events.push(...trailing);
    }

    return { events, sentinelSeen };
  }

  /**
   * Drain events until one satisfies `isComplete` — the adapter's
   * turn-completion signal (e.g. the Vellum daemon's `message_complete`)
   * — then drain trailing events (usage records, sync notifications)
   * with a short `graceQuietMs` quiet window before returning.
   *
   * Unlike `collectUntilQuiet` there is **no quiet window before the
   * completion event**: a turn that sits silent for a long pre-loop
   * phase (memory retrieval, embedding, first-token latency) is still
   * in flight, and only the `maxMs` hard cap — the caller's remaining
   * wall-clock budget for the run — bounds the wait. `completed: false`
   * means the stream ended or the cap elapsed without the turn ever
   * signalling completion; callers should fail loudly rather than
   * grading a truncated turn.
   */
  async collectUntilTurnComplete(input: {
    isComplete: (event: AgentEvent) => boolean;
    maxMs: number;
    graceQuietMs: number;
    onEvent?: (event: AgentEvent) => void | Promise<void>;
  }): Promise<{ events: AgentEvent[]; completed: boolean }> {
    const hardDeadline = Date.now() + input.maxMs;
    const events: AgentEvent[] = [];
    let completed = false;

    while (!completed) {
      const waitMs = hardDeadline - Date.now();
      if (waitMs <= 0) return { events, completed };

      const result = await Promise.race([this.next(), timeout(waitMs)]);
      if (result === TIMEOUT) return { events, completed };

      this.pending = undefined;
      if (result.done) return { events, completed };

      events.push(result.value);
      if (input.onEvent) await input.onEvent(result.value);
      if (input.isComplete(result.value)) completed = true;
    }

    const trailing = await this.drain({
      quietMs: input.graceQuietMs,
      maxMs: Math.max(0, hardDeadline - Date.now()),
      onEvent: input.onEvent,
    });
    events.push(...trailing);
    return { events, completed };
  }
}
