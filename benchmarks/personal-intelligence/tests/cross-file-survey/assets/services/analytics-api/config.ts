// Service config for analytics-api (analytics tier, api). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "analytics-api",
  tier: "analytics",
  timeoutSeconds: 90,
  retries: 4,
  backoffMs: 200,
};

// Liveness probing. The orchestrator restarts the pod after
// `unhealthyThreshold` consecutive failed probes.
export const healthCheck = {
  path: "/healthz",
  intervalSeconds: 10,
  unhealthyThreshold: 2,
};

// Ingress throttling, enforced at the gateway before requests reach
// the service.
export const rateLimit = {
  requestsPerSecond: 60,
  burst: 120,
};

// Alert routing. Page the owning team when the error rate crosses
// the threshold for two consecutive windows.
export const alerting = {
  channel: "#oncall-analytics",
  errorRatePercent: 3,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "debug",
  METRICS_PORT: 9420,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
