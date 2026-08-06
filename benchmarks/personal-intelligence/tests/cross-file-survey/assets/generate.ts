#!/usr/bin/env bun
// generate.ts — regenerates the services/ config tree and prints the
// ground truth for constants.ts. Run from this directory:  bun generate.ts
// Never hand-edit services/ or the constants it prints.
//
// The tree carries two traps so that grep-alone or head-of-file-alone
// reading produces the wrong survey:
//
//   - Three configs declare a base `timeoutSeconds` at or under the 30s
//     threshold near the top and override it past the threshold in an
//     `overrides` block near the bottom of the same file. The effective
//     value is the override; an agent that stops at the first match (or
//     the head of the file) misses all three.
//   - Two configs reference a shared constant from services/shared/
//     timeouts.ts instead of a literal. One resolves over the threshold,
//     one under; neither is countable without reading the second file.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Strictly-greater-than threshold the survey asks about, in seconds. */
const THRESHOLD_SECONDS = 30;

const TIERS = [
  "auth",
  "billing",
  "catalog",
  "checkout",
  "search",
  "payments",
  "orders",
  "inventory",
  "shipping",
  "notifications",
  "analytics",
  "reports",
  "media",
  "profiles",
  "sessions",
  "webhooks",
  "emails",
  "exports",
  "imports",
  "audit",
];
const KINDS = ["api", "worker"];

/**
 * Deterministic pool of base timeouts for the plain configs. Three of
 * twelve are over the threshold, so a stride-7 walk over 35 plain
 * services lands a stable handful of honestly-over services.
 */
const TIMEOUT_CHOICES = [5, 8, 10, 12, 15, 20, 24, 25, 30, 45, 60, 90];

/**
 * TRAP (a) — the in-file override. Base near the top of the file is at
 * or under the threshold; the `overrides` block near the bottom is the
 * effective value and is over it.
 */
const OVERRIDE_TRAPS: Record<string, { base: number; override: number }> = {
  "billing-api": { base: 30, override: 95 },
  "search-worker": { base: 25, override: 120 },
  "exports-api": { base: 30, override: 45 },
};

/**
 * TRAP (b) — the shared constant. `timeoutSeconds` is a named import
 * from services/shared/timeouts.ts, not a literal in the config file.
 */
const SHARED_CONSTANTS: Record<string, { constant: string; value: number }> = {
  "analytics-worker": { constant: "SLOW_BATCH_TIMEOUT_SECONDS", value: 120 },
  "profiles-api": { constant: "DEFAULT_HTTP_TIMEOUT_SECONDS", value: 20 },
};

interface Service {
  name: string;
  tier: string;
  kind: string;
  index: number;
  /** The number effective at runtime — override > constant > base. */
  effectiveSeconds: number;
  /**
   * What a naive pass attributes to the file: the base literal, or
   * undefined when the declaration is an unresolved constant reference.
   */
  naiveSeconds: number | undefined;
}

const services: Service[] = [];
let index = 0;
for (const tier of TIERS) {
  for (const kind of KINDS) {
    const name = `${tier}-${kind}`;
    const override = OVERRIDE_TRAPS[name];
    const shared = SHARED_CONSTANTS[name];
    const base =
      override?.base ??
      TIMEOUT_CHOICES[(index * 7 + 3) % TIMEOUT_CHOICES.length];
    services.push({
      name,
      tier,
      kind,
      index,
      effectiveSeconds: override?.override ?? shared?.value ?? base,
      naiveSeconds: shared === undefined ? base : undefined,
    });
    index += 1;
  }
}

/** The config file body, prettier-formatted so `format:check` stays green. */
function configFile(service: Service): string {
  const { name, tier, kind, index: i } = service;
  const override = OVERRIDE_TRAPS[name];
  const shared = SHARED_CONSTANTS[name];
  const timeoutValue = shared?.constant ?? String(service.naiveSeconds);

  const lines: string[] = [
    `// Service config for ${name} (${tier} tier, ${kind}). Managed by`,
    "// platform-infra; edit via PR, deploys pick it up on the next rollout.",
  ];
  if (shared !== undefined) {
    lines.push(`import { ${shared.constant} } from "../shared/timeouts";`, "");
  } else {
    lines.push("");
  }
  lines.push(
    "export const config = {",
    `  name: "${name}",`,
    `  tier: "${tier}",`,
    `  timeoutSeconds: ${timeoutValue},`,
    `  retries: ${2 + (i % 3)},`,
    `  backoffMs: ${200 + (i % 5) * 50},`,
    "};",
    "",
    "// Liveness probing. The orchestrator restarts the pod after",
    "// `unhealthyThreshold` consecutive failed probes.",
    "export const healthCheck = {",
    '  path: "/healthz",',
    `  intervalSeconds: ${10 + (i % 4) * 5},`,
    `  unhealthyThreshold: ${2 + (i % 2)},`,
    "};",
    "",
    "// Ingress throttling, enforced at the gateway before requests reach",
    "// the service.",
    "export const rateLimit = {",
    `  requestsPerSecond: ${20 + (i % 8) * 10},`,
    `  burst: ${(20 + (i % 8) * 10) * 2},`,
    "};",
    "",
    "// Alert routing. Page the owning team when the error rate crosses",
    "// the threshold for two consecutive windows.",
    "export const alerting = {",
    `  channel: "#oncall-${tier}",`,
    `  errorRatePercent: ${1 + (i % 3)},`,
    "  windowSeconds: 300,",
    "};",
    "",
    "// Injected into the container environment at deploy time.",
    "export const environment = {",
    `  LOG_LEVEL: "${i % 4 === 0 ? "debug" : "info"}",`,
    `  METRICS_PORT: ${9400 + i},`,
    '  FEATURE_FLAGS_SOURCE: "flagsmith",',
    "};",
  );
  if (override !== undefined) {
    lines.push(
      "",
      "// Deploy-time overrides. Applied AFTER `config` when the loader",
      "// builds the effective settings: any field here supersedes the base",
      "// value declared above.",
      "export const overrides = {",
      `  timeoutSeconds: ${override.override},`,
      "};",
    );
  }
  return lines.join("\n") + "\n";
}

const sharedTimeoutsFile = [
  "// Shared timeout policy. Services that inherit a fleet-wide value",
  "// reference these constants instead of hardcoding a number.",
  "",
  "/** Interactive HTTP services: keep user-facing requests snappy. */",
  `export const DEFAULT_HTTP_TIMEOUT_SECONDS = ${SHARED_CONSTANTS["profiles-api"].value};`,
  "",
  "/** Long-running batch pipelines: generous by design. */",
  `export const SLOW_BATCH_TIMEOUT_SECONDS = ${SHARED_CONSTANTS["analytics-worker"].value};`,
  "",
].join("\n");

const outDir = join(import.meta.dir, "services");
rmSync(outDir, { recursive: true, force: true });
const files: Record<string, string> = {
  "shared/timeouts.ts": sharedTimeoutsFile,
};
for (const service of services) {
  files[`${service.name}/config.ts`] = configFile(service);
}
for (const [relPath, content] of Object.entries(files)) {
  const target = join(outDir, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

// Ground truth: effective values, with overrides applied and shared
// constants resolved. The naive count is what a pass that takes each
// file's top-of-file literal at face value produces — it misses all
// three overrides, and the constant references resolve to no number at
// all (the over-threshold one simply goes uncounted).
const over = services
  .filter((service) => service.effectiveSeconds > THRESHOLD_SECONDS)
  .sort((a, b) => a.name.localeCompare(b.name));
const under = services
  .filter((service) => service.effectiveSeconds <= THRESHOLD_SECONDS)
  .map((service) => service.name)
  .sort((a, b) => a.localeCompare(b));
const naiveCount = services.filter(
  (service) =>
    service.naiveSeconds !== undefined &&
    service.naiveSeconds > THRESHOLD_SECONDS,
).length;

console.log(
  JSON.stringify(
    {
      servicesOverThreshold: Object.fromEntries(
        over.map((service) => [service.name, service.effectiveSeconds]),
      ),
      expectedCount: over.length,
      servicesUnderThreshold: under,
      naiveCountIfOverridesMissed: naiveCount,
      fileCount: services.length,
    },
    null,
    2,
  ),
);
