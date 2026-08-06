// Service config for emails-worker (emails tier, worker). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "emails-worker",
  tier: "emails",
  timeoutSeconds: 24,
  retries: 2,
  backoffMs: 350,
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
  channel: "#oncall-emails",
  errorRatePercent: 1,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9433,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};
