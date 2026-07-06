/**
 * Session-id resolution for `evals run`.
 *
 * A session id groups every (profile, unit) execution of one invocation
 * under `.runs/`, the report server, and export. It is either supplied
 * explicitly (`--session-id`, then `$EVAL_RESULTS_SESSION_ID` — the
 * eval-pod launcher sets the env var so its run id and the uploaded
 * bundle id coincide) or generated here.
 */
import { randomBytes } from "crypto";

/**
 * Session-id suffix used to disambiguate concurrent evals invocations.
 *
 * Format: `YYYYMMDDhhmmssSSS-XXXX` (17-digit ms-precision timestamp + 4
 * hex chars of randomness). The per-(profile, unit) run id stamping
 * happens inside each benchmark's `run()` module — we only need the
 * session-level suffix here so every execution in this invocation
 * clusters under the same session in the report server.
 */
export function sessionTimestampSuffix(): string {
  const ms = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 17);
  const rand = randomBytes(2).toString("hex");
  return `${ms}-${rand}`;
}

function slugifyLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug.length > 0 ? slug : "";
}

export function generateSessionId(
  label: string | undefined,
  timestamp: string,
): string {
  const slug = label ? slugifyLabel(label) : "";
  return slug ? `session-${timestamp}-${slug}` : `session-${timestamp}`;
}

/**
 * Allowed shape for externally supplied session ids. The id flows into
 * filesystem-adjacent grouping (`.runs/`) and URLs, so no dots, slashes,
 * or spaces: letters, digits, hyphen, underscore; must start
 * alphanumeric; max 128 chars.
 */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function assertValidSessionId(
  id: string,
  source: "--session-id" | "EVAL_RESULTS_SESSION_ID",
): void {
  if (!SESSION_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid session id from ${source}: "${id}". Allowed: letters, digits, hyphen, underscore; must start alphanumeric; max 128 chars.`,
    );
  }
}

/**
 * Resolve the session id for a run: explicit `--session-id` wins, then
 * `$EVAL_RESULTS_SESSION_ID`, then a generated `session-<ts>[-<slug>]`
 * id. Explicit/env ids are validated and used verbatim — the label is
 * never woven into them (it still lands on run metadata separately).
 */
export function resolveSessionId(input: {
  explicit?: string;
  env?: NodeJS.ProcessEnv;
  label?: string;
}): string {
  const explicit = input.explicit?.trim();
  if (explicit) {
    assertValidSessionId(explicit, "--session-id");
    return explicit;
  }

  // A whitespace-only env value is treated as unset.
  const fromEnv = input.env?.EVAL_RESULTS_SESSION_ID?.trim();
  if (fromEnv) {
    assertValidSessionId(fromEnv, "EVAL_RESULTS_SESSION_ID");
    return fromEnv;
  }

  return generateSessionId(input.label, sessionTimestampSuffix());
}
