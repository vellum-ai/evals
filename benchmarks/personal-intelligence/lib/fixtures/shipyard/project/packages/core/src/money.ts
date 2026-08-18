/** Money is integer cents everywhere. Floats never cross a boundary. */

/** Dollars to cents, rounded once, at the edge. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Sum cents. Integers in, integer out. */
export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Apply a rate to a cents amount and round ONCE, at the end.
 *
 * Rounding each part and then summing drifts by a cent per part, which
 * is how a total ends up a cent light. Every caller applies a rate to a
 * total, never part by part.
 */
export function applyRate(cents: number, rate: number): number {
  return Math.round(cents * (1 + rate));
}

/** Cents as `$1,234.56`. */
export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const part = String(abs % 100).padStart(2, "0");
  return `${sign}$${whole}.${part}`;
}
