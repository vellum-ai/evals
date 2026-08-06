// Service config for notifications-api (notifications tier, api). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "notifications-api",
  tier: "notifications",
  timeoutSeconds: 45,
  retries: 2,
  backoffMs: 350,
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
  channel: "#oncall-notifications",
  errorRatePercent: 1,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9418,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
