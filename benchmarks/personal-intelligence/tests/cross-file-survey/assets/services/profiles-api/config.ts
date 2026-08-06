// Service config for profiles-api (profiles tier, api). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.
import { DEFAULT_HTTP_TIMEOUT_SECONDS } from "../shared/timeouts";

export const config = {
  name: "profiles-api",
  tier: "profiles",
  timeoutSeconds: DEFAULT_HTTP_TIMEOUT_SECONDS,
  retries: 4,
  backoffMs: 250,
};

// Liveness probing. The orchestrator restarts the pod after
// `unhealthyThreshold` consecutive failed probes.
export const healthCheck = {
  path: "/healthz",
  intervalSeconds: 20,
  unhealthyThreshold: 2,
};

// Ingress throttling, enforced at the gateway before requests reach
// the service.
export const rateLimit = {
  requestsPerSecond: 40,
  burst: 80,
};

// Alert routing. Page the owning team when the error rate crosses
// the threshold for two consecutive windows.
export const alerting = {
  channel: "#oncall-profiles",
  errorRatePercent: 3,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9426,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
