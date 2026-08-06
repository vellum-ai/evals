// Service config for exports-worker (exports tier, worker). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "exports-worker",
  tier: "exports",
  timeoutSeconds: 30,
  retries: 4,
  backoffMs: 200,
};

// Liveness probing. The orchestrator restarts the pod after
// `unhealthyThreshold` consecutive failed probes.
export const healthCheck = {
  path: "/healthz",
  intervalSeconds: 25,
  unhealthyThreshold: 3,
};

// Ingress throttling, enforced at the gateway before requests reach
// the service.
export const rateLimit = {
  requestsPerSecond: 50,
  burst: 100,
};

// Alert routing. Page the owning team when the error rate crosses
// the threshold for two consecutive windows.
export const alerting = {
  channel: "#oncall-exports",
  errorRatePercent: 3,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9435,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
