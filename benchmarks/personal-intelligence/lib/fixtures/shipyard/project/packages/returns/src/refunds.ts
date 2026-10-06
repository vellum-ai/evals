import { formatUsd, sumCents } from "../../core/src/money";

/** A line the customer is sending back. */
export interface ReturnLine {
  sku: string;
  cents: number;
  restocked: boolean;
}

/** What goes back on the card: only what came back on the shelf. */
export function refundCents(lines: ReturnLine[]): number {
  return sumCents(
    lines.filter((line) => line.restocked).map((line) => line.cents),
  );
}

/** What the customer is told they are getting back. */
export function refundNote(lines: ReturnLine[]): string {
  return `Refunding ${formatUsd(refundCents(lines))}`;
}
