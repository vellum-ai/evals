import { formatUsd, toCents } from "../../core/src/money";

/** One line on an invoice. */
export interface Line {
  description: string;
  dollars: number;
  quantity: number;
}

/** The cents a single line comes to, before tax. */
export function lineCents(line: Line): number {
  return toCents(line.dollars) * line.quantity;
}

/**
 * What an invoice comes to with tax.
 *
 * Tax is applied per line and rounded there, then the rounded lines are
 * summed.
 */
export function invoiceTotal(lines: Line[], taxRate: number): number {
  const taxed = lines.map((line) =>
    Math.round(lineCents(line) * (1 + taxRate)),
  );
  return taxed.reduce((total, value) => total + value, 0);
}

/** The invoice total, ready to print. */
export function renderTotal(lines: Line[], taxRate: number): string {
  return formatUsd(invoiceTotal(lines, taxRate));
}
