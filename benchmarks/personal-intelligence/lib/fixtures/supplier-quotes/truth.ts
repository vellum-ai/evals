/**
 * Ground truth for the supplier-quotes fixture: what each quote comes to
 * and how long it takes to arrive. Derived from `quotes.ts` by
 * `generate.ts`, which prints exactly these figures. Regenerate rather
 * than editing here.
 */
import { formatUsd, QUOTES, quoteTotalCents } from "./quotes";

/** Workspace-relative directory the quotes are staged under. */
export const QUOTES_DIR = "quotes";

/** How many quotes there are — the count the ask names. */
export const QUOTE_COUNT = QUOTES.length;

/** One supplier's answer, as a summary has to state it. */
export interface QuoteTruth {
  supplier: string;
  totalCents: number;
  /** The total as dollars, e.g. `$444.00`. */
  total: string;
  leadDays: number;
}

/** Every supplier's total and lead time, in fixture order. */
export const QUOTE_TRUTH: QuoteTruth[] = QUOTES.map((quote) => {
  const totalCents = quoteTotalCents(quote);
  return {
    supplier: quote.supplier,
    totalCents,
    total: formatUsd(totalCents),
    leadDays: quote.leadDays,
  };
});

/** The supplier a correct summary calls cheapest. */
export const CHEAPEST = QUOTE_TRUTH.reduce((best, row) =>
  row.totalCents < best.totalCents ? row : best,
);

/** The supplier with the shortest lead time. */
export const FASTEST = QUOTE_TRUTH.reduce((best, row) =>
  row.leadDays < best.leadDays ? row : best,
);
