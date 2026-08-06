// Service config for analytics-worker (analytics tier, worker). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.
import { SLOW_BATCH_TIMEOUT_SECONDS } from "../shared/timeouts";

export const config = {
  name: "analytics-worker",
  tier: "analytics",
  timeoutSeconds: SLOW_BATCH_TIMEOUT_SECONDS,
  retries: 2,
  backoffMs: 250,
};

// Liveness probing. The orchestrator restarts the pod after
// `unhealthyThreshold` consecutive failed probes.
export const healthCheck = {
  path: "/healthz",
  intervalSeconds: 15,
  unhealthyThreshold: 3,
};

// Ingress throttling, enforced at the gateway before requests reach
// the service.
export const rateLimit = {
  requestsPerSecond: 70,
  burst: 140,
};

// Alert routing. Page the owning team when the error rate crosses
// the threshold for two consecutive windows.
export const alerting = {
  channel: "#oncall-analytics",
  errorRatePercent: 1,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9421,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
