// Service config for search-api (search tier, api). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "search-api",
  tier: "search",
  timeoutSeconds: 90,
  retries: 4,
  backoffMs: 350,
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
  requestsPerSecond: 20,
  burst: 40,
};

// Alert routing. Page the owning team when the error rate crosses
// the threshold for two consecutive windows.
export const alerting = {
  channel: "#oncall-search",
  errorRatePercent: 3,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "debug",
  METRICS_PORT: 9408,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
