#!/usr/bin/env bun
// generate.ts — regenerates logs/gateway.log and prints the ground truth
// for constants.ts. Run from this directory:  bun generate.ts
// Never hand-edit logs/ or the constants it prints.
//
// Shape of the fixture (all offsets deterministic — seeded PRNG):
//
//   - ~40,000 dense structured lines (~4 MB). Every line is >= 80 chars,
//     so any default 2000-line file_read returns far more than the
//     assistant's 25,000-char spool threshold and gets replaced by a
//     `.tool-results/` stub — the round-trip this case exists to measure.
//   - THE INCIDENT: in the final 5% of the file, checkout-service logs
//     exactly INCIDENT_ERRORS ERROR lines inside a <10-minute window,
//     opening with a distinctive first message (expired payments-gateway
//     certificate).
//   - THE TRAP: inside the first 2000 lines — the default read window —
//     an older, different checkout-service burst (connection pool
//     exhaustion) with a different count and first message. A
//     truncation-blind agent reports this burst's numbers.
//   - checkout-service ERROR lines exist ONLY in those two bursts, so
//     both the trap answer and the correct answer are exact greps.
//     Other services error at random throughout as noise.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TOTAL_LINES = 40_000;

// Trap burst: 14 ERROR lines at every 10th line of [1200, 1340) —
// comfortably inside the default 2000-line window.
const TRAP_START = 1_200;
const TRAP_END = 1_340;
const TRAP_STEP = 10;

// Incident burst: 47 ERROR lines at every 20th line of [38600, 39540) —
// inside the final 5% (>= line 38,000).
const INCIDENT_START = 38_600;
const INCIDENT_END = 39_540;
const INCIDENT_STEP = 20;

const INCIDENT_SERVICE = "checkout-service";
const INCIDENT_FIRST_MESSAGE =
  "TLS handshake failed: upstream payments-gateway certificate expired";
// "certificate expired" appears ONLY in the first incident line — it is
// the discriminator the answer metric keys on. Later messages describe
// the same outage without it.
const INCIDENT_LATER_MESSAGES = [
  "upstream payments-gateway unreachable: TLS handshake failure",
  "payment authorization failed: no response from payments-gateway",
];

const TRAP_FIRST_MESSAGE =
  "connection pool exhausted: checkout-db-2 refusing new connections";
// Likewise "checkout-db-2" appears ONLY in the first trap line.
const TRAP_LATER_MESSAGES = [
  "connection pool exhausted: waited 5000ms for a free connection",
  "db query aborted: connection pool exhausted",
];

// Noise vocabulary. None of these strings may contain the incident/trap
// discriminators ("payments-gateway", "certificate expired",
// "connection pool exhausted", "checkout-db-2").
const NOISE_SERVICES = [
  "cart-service",
  "auth-service",
  "inventory-service",
  "search-service",
  "shipping-service",
  INCIDENT_SERVICE, // INFO/WARN only — never ERROR outside the bursts
];
const INFO_MESSAGES = [
  "request completed",
  "served from cache",
  "session refreshed",
  "healthcheck ok",
  "rate window reset",
];
const WARN_MESSAGES = [
  "slow upstream response",
  "retrying after upstream hiccup",
  "cache miss ratio high",
];
const NOISE_ERROR_MESSAGES = [
  "request timed out after 30000ms",
  "upstream returned 503 during deploy",
  "unexpected EOF reading response body",
];

// Deterministic PRNG (mulberry32) — same seed, same log, same truth.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x109_7514);
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)];
const hex = (chars: number): string =>
  Array.from({ length: chars }, () =>
    Math.floor(rand() * 16).toString(16),
  ).join("");

function isTrapLine(i: number): boolean {
  return i >= TRAP_START && i < TRAP_END && (i - TRAP_START) % TRAP_STEP === 0;
}
function isIncidentLine(i: number): boolean {
  return (
    i >= INCIDENT_START &&
    i < INCIDENT_END &&
    (i - INCIDENT_START) % INCIDENT_STEP === 0
  );
}

// Clock: seconds-scale increments normally (the log spans about two
// days), millisecond-scale inside the incident region so the whole
// burst fits a 10-minute window.
let clockMs = Date.parse("2026-02-09T00:00:00.000Z");
function advanceClock(i: number): void {
  const inIncidentRegion = i >= INCIDENT_START && i < INCIDENT_END;
  clockMs += inIncidentRegion
    ? 200 + Math.floor(rand() * 700) // avg ~550ms → ~8.6 min over 940 lines
    : 1000 * (1 + Math.floor(rand() * 8)); // 1-8s
}

interface Line {
  level: "INFO" | "WARN" | "ERROR";
  service: string;
  status: number;
  latencyMs: number;
  message: string;
}

function noiseLine(): Line {
  const roll = rand();
  if (roll < 0.9) {
    return {
      level: "INFO",
      service: pick(NOISE_SERVICES),
      status: pick([200, 200, 200, 201, 204]),
      latencyMs: 5 + Math.floor(rand() * 250),
      message: pick(INFO_MESSAGES),
    };
  }
  if (roll < 0.97) {
    return {
      level: "WARN",
      service: pick(NOISE_SERVICES),
      status: pick([200, 200, 429]),
      latencyMs: 400 + Math.floor(rand() * 2600),
      message: pick(WARN_MESSAGES),
    };
  }
  // Noise errors: any service EXCEPT checkout-service, whose ERROR lines
  // exist only in the two planted bursts.
  const errorServices = NOISE_SERVICES.filter((s) => s !== INCIDENT_SERVICE);
  return {
    level: "ERROR",
    service: pick(errorServices),
    status: pick([500, 502, 503, 504]),
    latencyMs: 1000 + Math.floor(rand() * 29000),
    message: pick(NOISE_ERROR_MESSAGES),
  };
}

const lines: string[] = [];
let trapCount = 0;
let incidentCount = 0;
let trapFirstAt = "";
let trapLastAt = "";
let incidentFirstAt = "";
let incidentLastAt = "";
let minLineLength = Number.POSITIVE_INFINITY;

for (let i = 0; i < TOTAL_LINES; i += 1) {
  advanceClock(i);
  const ts = new Date(clockMs).toISOString();

  let line: Line;
  if (isTrapLine(i)) {
    line = {
      level: "ERROR",
      service: INCIDENT_SERVICE,
      status: 500,
      latencyMs: 5000 + Math.floor(rand() * 2000),
      message:
        trapCount === 0
          ? TRAP_FIRST_MESSAGE
          : TRAP_LATER_MESSAGES[trapCount % TRAP_LATER_MESSAGES.length],
    };
    if (trapCount === 0) trapFirstAt = ts;
    trapLastAt = ts;
    trapCount += 1;
  } else if (isIncidentLine(i)) {
    line = {
      level: "ERROR",
      service: INCIDENT_SERVICE,
      status: 502,
      latencyMs: 1000 + Math.floor(rand() * 4000),
      message:
        incidentCount === 0
          ? INCIDENT_FIRST_MESSAGE
          : INCIDENT_LATER_MESSAGES[
              incidentCount % INCIDENT_LATER_MESSAGES.length
            ],
    };
    if (incidentCount === 0) incidentFirstAt = ts;
    incidentLastAt = ts;
    incidentCount += 1;
  } else {
    line = noiseLine();
  }

  const rendered = `${ts} ${line.level.padEnd(5)} ${line.service} req=${hex(
    8,
  )} status=${line.status} latency_ms=${String(line.latencyMs).padStart(
    4,
    "0",
  )} msg="${line.message}"`;
  minLineLength = Math.min(minLineLength, rendered.length);
  lines.push(rendered);
}

const body = lines.join("\n") + "\n";

// Invariants the case depends on. 2000 lines x >=80 chars >> the 25k-char
// spool threshold, and the incident must sit in the final 5%.
if (minLineLength < 80) {
  throw new Error(`line too lean for the spool trap: ${minLineLength} chars`);
}
if (INCIDENT_START < TOTAL_LINES * 0.95) {
  throw new Error("incident burst must start inside the final 5%");
}
const incidentWindowMs =
  Date.parse(incidentLastAt) - Date.parse(incidentFirstAt);
if (incidentWindowMs > 10 * 60 * 1000) {
  throw new Error(`incident window too wide: ${incidentWindowMs}ms`);
}

const outDir = join(import.meta.dir, "logs");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "gateway.log"), body);

console.log(
  JSON.stringify(
    {
      totalLines: TOTAL_LINES,
      bytes: Buffer.byteLength(body),
      minLineLength,
      incident: {
        service: INCIDENT_SERVICE,
        errorCount: incidentCount,
        firstMessage: INCIDENT_FIRST_MESSAGE,
        firstErrorAt: incidentFirstAt,
        lastErrorAt: incidentLastAt,
        windowMinutes: incidentWindowMs / 60_000,
        firstLine: INCIDENT_START + 1,
      },
      trap: {
        service: INCIDENT_SERVICE,
        errorCount: trapCount,
        firstMessage: TRAP_FIRST_MESSAGE,
        firstErrorAt: trapFirstAt,
        lastErrorAt: trapLastAt,
        firstLine: TRAP_START + 1,
      },
    },
    null,
    2,
  ),
);
