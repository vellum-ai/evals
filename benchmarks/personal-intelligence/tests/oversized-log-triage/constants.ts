/**
 * Ground truth for the gateway-log fixture. Derived by running
 * `bun assets/generate.ts`, which writes `assets/logs/gateway.log` and
 * prints exactly these numbers — regenerate that way rather than editing
 * here.
 */

/** Workspace-relative path the log is staged at. */
export const LOG_PATH = "logs/gateway.log";

/** The service the incident (and the trap) belong to. */
export const INCIDENT_SERVICE = "checkout-service";

/**
 * THE INCIDENT — final 5% of the file, far past the default 2000-line
 * read window: exactly this many checkout-service ERROR lines inside an
 * ~8.4-minute window, opening with `FIRST_ERROR_MESSAGE`.
 */
export const CORRECT_ERROR_COUNT = 47;
export const FIRST_ERROR_MESSAGE =
  "TLS handshake failed: upstream payments-gateway certificate expired";

/**
 * THE TRAP — an older checkout-service burst planted inside the first
 * 2000 lines (starting at line 1201). A truncation-blind agent that
 * reads the default window and stops reports this burst's count and
 * first message instead.
 */
export const TRAP_ERROR_COUNT = 14;
export const TRAP_FIRST_MESSAGE =
  "connection pool exhausted: checkout-db-2 refusing new connections";

/**
 * Target assistant spend for a good run, in USD. Placeholder — calibrate
 * to observed post-fix medians after the first real runs (see the
 * coding-cost baseline runbook).
 */
export const COST_BASELINE_USD = 0.1;
