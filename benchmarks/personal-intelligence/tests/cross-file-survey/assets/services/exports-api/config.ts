// Service config for exports-api (exports tier, api). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "exports-api",
  tier: "exports",
  timeoutSeconds: 30,
  retries: 3,
  backoffMs: 400,
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
  channel: "#oncall-exports",
  errorRatePercent: 2,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9434,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};

// Deploy-time overrides. Applied AFTER `config` when the loader
// builds the effective settings: any field here supersedes the base
// value declared above.
export const overrides = {
  timeoutSeconds: 45,
};
