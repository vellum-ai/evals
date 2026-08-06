// Service config for auth-worker (auth tier, worker). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "auth-worker",
  tier: "auth",
  timeoutSeconds: 60,
  retries: 3,
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
  requestsPerSecond: 30,
  burst: 60,
};

// Alert routing. Page the owning team when the error rate crosses
// the threshold for two consecutive windows.
export const alerting = {
  channel: "#oncall-auth",
  errorRatePercent: 2,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9401,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
