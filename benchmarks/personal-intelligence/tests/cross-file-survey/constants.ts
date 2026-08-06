/**
 * Ground truth for the services/ config fixtures. Derived by running
 * `bun assets/generate.ts`, which writes `assets/services/` and prints
 * exactly these values — regenerate that way rather than editing here.
 */

/**
 * The services whose EFFECTIVE timeout is over 30 seconds, with the
 * effective value: in-file `overrides` blocks applied (billing-api,
 * search-worker, exports-api) and shared constants resolved
 * (analytics-worker's `SLOW_BATCH_TIMEOUT_SECONDS`).
 */
export const SERVICES_OVER_THRESHOLD: Record<string, number> = {
  "analytics-api": 90,
  "analytics-worker": 120,
  "auth-worker": 60,
  "billing-api": 95,
  "checkout-api": 45,
  "emails-api": 90,
  "exports-api": 45,
  "imports-worker": 60,
  "media-worker": 60,
  "notifications-api": 45,
  "orders-worker": 60,
  "search-api": 90,
  "search-worker": 120,
  "webhooks-api": 45,
};

/** How many services are effectively over the threshold. */
export const EXPECTED_COUNT = 14;

/**
 * Every service NOT over the threshold — including profiles-api, whose
 * shared-constant timeout resolves to 20s (an agent that assumes
 * "constant reference ⇒ probably big" falsely includes it). Used to
 * detect false positives in the reported list.
 */
export const SERVICES_UNDER_THRESHOLD: string[] = [
  "audit-api",
  "audit-worker",
  "auth-api",
  "billing-worker",
  "catalog-api",
  "catalog-worker",
  "checkout-worker",
  "emails-worker",
  "exports-worker",
  "imports-api",
  "inventory-api",
  "inventory-worker",
  "media-api",
  "notifications-worker",
  "orders-api",
  "payments-api",
  "payments-worker",
  "profiles-api",
  "profiles-worker",
  "reports-api",
  "reports-worker",
  "sessions-api",
  "sessions-worker",
  "shipping-api",
  "shipping-worker",
  "webhooks-worker",
];

/**
 * The count a naive pass produces: each file's top-of-file literal taken
 * at face value. That misses all three in-file overrides, and the two
 * shared-constant references resolve to no number at all — so the
 * over-threshold one (analytics-worker) simply goes uncounted. An answer
 * of exactly this count is the tell that neither trap was resolved.
 */
export const NAIVE_COUNT_IF_OVERRIDES_MISSED = 10;

/**
 * Target assistant spend for a good run, in USD. Placeholder — calibrate
 * to observed post-fix medians after the first real runs (see the
 * coding-cost-baseline runbook).
 */
export const COST_BASELINE_USD = 0.15;

/**
 * Conversation wall-clock that earns full runtime marks, in ms. A 40-file
 * survey should resolve inside a few minutes. Placeholder — calibrate to
 * observed post-fix medians after the first real runs.
 */
export const RUNTIME_BASELINE_MS = 240_000;
