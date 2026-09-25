/**
 * Best-effort live publishing for launcher-started eval sessions.
 *
 * The final bundle upload in commands/run.ts remains authoritative and may
 * fail the Job. This publisher only makes partial artifacts available while
 * the run is active. Refresh requests are serialized and coalesced so several
 * workers finishing together produce one follow-up snapshot rather than
 * overlapping bundle builds that can land out of order.
 */
import type { RunMetadata, RunMetadataObserver } from "./metrics";
import { pushBundleToUrl } from "./bundle-push";
import { readDashboardEnv } from "./dashboard-env";

const LIVE_UPLOAD_TIMEOUT_MS = 30_000;
const MAX_FAILURE_WARNINGS = 3;

export interface IncrementalSessionPublisher {
  observer: RunMetadataObserver;
  /** Wait until every requested refresh has settled. Never rejects. */
  settle(): Promise<void>;
}

/**
 * Creates a publisher only when the dashboard URL and bearer token are both
 * configured. Missing credentials are reported by the existing final
 * auto-publish path, so this helper stays silent when live publishing is off.
 */
export function createIncrementalSessionPublisher(input: {
  sessionId: string;
  env?: NodeJS.ProcessEnv;
  push?: typeof pushBundleToUrl;
  timeoutMs?: number;
}): IncrementalSessionPublisher | undefined {
  const { baseUrl, authToken } = readDashboardEnv(input.env);
  if (!baseUrl || !authToken) return undefined;

  const push = input.push ?? pushBundleToUrl;
  const timeoutMs = input.timeoutMs ?? LIVE_UPLOAD_TIMEOUT_MS;
  const terminalRuns = new Set<string>();

  let runningObserved = false;
  let requestedVersion = 0;
  let publishedVersion = 0;
  let drain: Promise<void> | undefined;
  let publishedOnce = false;
  let failureCount = 0;

  const publishSnapshot = async (): Promise<void> => {
    try {
      const { viewUrl } = await push(input.sessionId, baseUrl, {
        authToken,
        timeoutMs,
        isFinal: false,
        quiet: true,
      });
      if (!publishedOnce) {
        publishedOnce = true;
        console.log(`[evals] live artifacts available at ${viewUrl}`);
      }
    } catch (error) {
      failureCount += 1;
      if (failureCount <= MAX_FAILURE_WARNINGS) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[evals] live artifact refresh failed for session ${input.sessionId}: ${message}`,
        );
      } else if (failureCount === MAX_FAILURE_WARNINGS + 1) {
        console.warn(
          "[evals] further live artifact refresh warnings suppressed",
        );
      }
    }
  };

  const startDrain = (): void => {
    if (drain) return;
    drain = (async () => {
      while (publishedVersion < requestedVersion) {
        const targetVersion = requestedVersion;
        await publishSnapshot();
        publishedVersion = targetVersion;
      }
    })().finally(() => {
      drain = undefined;
      // A request can arrive after the loop sees no work but before this
      // finally runs. Start another drain so that edge is not lost.
      if (publishedVersion < requestedVersion) startDrain();
    });
  };

  const requestRefresh = (): void => {
    requestedVersion += 1;
    startDrain();
  };

  const observer: RunMetadataObserver = (metadata: RunMetadata) => {
    if (metadata.sessionId !== input.sessionId) return;

    if (metadata.status === "running") {
      // The first durable execution makes the page useful. Further execution
      // starts add no result data, so wait for terminal transitions instead.
      if (runningObserved) return;
      runningObserved = true;
      requestRefresh();
      return;
    }

    if (metadata.status === "completed" || metadata.status === "failed") {
      // Cleanup paths can rewrite a terminal status. Publish each execution's
      // result once.
      if (terminalRuns.has(metadata.runId)) return;
      terminalRuns.add(metadata.runId);
      requestRefresh();
    }
  };

  return {
    observer,
    async settle(): Promise<void> {
      while (drain || publishedVersion < requestedVersion) {
        if (!drain) startDrain();
        await drain?.catch(() => undefined);
      }
    },
  };
}
