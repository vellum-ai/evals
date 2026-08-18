import { applyRate, formatUsd } from "../../core/src/money";

/** A charge as the payment processor would take it. */
export interface Charge {
  invoiceId: string;
  cents: number;
  currency: "usd";
}

/** Build a charge for an invoice total, with the processor's surcharge. */
export function buildCharge(
  invoiceId: string,
  subtotalCents: number,
  surcharge: number,
): Charge {
  return {
    invoiceId,
    cents: applyRate(subtotalCents, surcharge),
    currency: "usd",
  };
}

/** What the customer sees on the statement. */
export function describeCharge(charge: Charge): string {
  return `${charge.invoiceId} ${formatUsd(charge.cents)}`;
}
