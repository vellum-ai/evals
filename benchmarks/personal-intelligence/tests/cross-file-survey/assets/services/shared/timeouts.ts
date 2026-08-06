// Shared timeout policy. Services that inherit a fleet-wide value
// reference these constants instead of hardcoding a number.

/** Interactive HTTP services: keep user-facing requests snappy. */
export const DEFAULT_HTTP_TIMEOUT_SECONDS = 20;

/** Long-running batch pipelines: generous by design. */
export const SLOW_BATCH_TIMEOUT_SECONDS = 120;
