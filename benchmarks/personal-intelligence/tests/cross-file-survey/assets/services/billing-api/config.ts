// Service config for billing-api (billing tier, api). Managed by
// platform-infra; edit via PR, deploys pick it up on the next rollout.

export const config = {
  name: "billing-api",
  tier: "billing",
  timeoutSeconds: 30,
  retries: 4,
  backoffMs: 300,
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
  channel: "#oncall-billing",
  errorRatePercent: 3,
  windowSeconds: 300,
};

// Injected into the container environment at deploy time.
export const environment = {
  LOG_LEVEL: "info",
  METRICS_PORT: 9402,
  FEATURE_FLAGS_SOURCE: "flagsmith",
};

// Deploy-time overrides. Applied AFTER `config` when the loader
// builds the effective settings: any field here supersedes the base
// value declared above.
export const overrides = {
  timeoutSeconds: 95,
};
