import { formatUsd, sumCents } from "../../core/src/money";

/** One order, as the day's report sees it. */
export interface OrderRow {
  orderId: string;
  cents: number;
  refunded: boolean;
}

/** What the shop took today, refunds excluded. */
export function dayTotal(rows: OrderRow[]): number {
  return sumCents(rows.filter((row) => !row.refunded).map((row) => row.cents));
}

/** The one-line summary the owner reads over coffee. */
export function daySummary(rows: OrderRow[]): string {
  const kept = rows.filter((row) => !row.refunded).length;
  return `${kept} order(s), ${formatUsd(dayTotal(rows))}`;
}
