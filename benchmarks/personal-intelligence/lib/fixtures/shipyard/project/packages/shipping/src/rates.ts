import { applyRate } from "../../core/src/money";

/** A shipping band, cheapest first. */
interface Band {
  upToGrams: number;
  cents: number;
}

const BANDS: Band[] = [
  { upToGrams: 500, cents: 495 },
  { upToGrams: 2000, cents: 795 },
  { upToGrams: 10000, cents: 1495 },
];

/** What it costs to ship a parcel of this weight. */
export function shippingCents(grams: number): number {
  const band = BANDS.find((candidate) => grams <= candidate.upToGrams);
  if (band === undefined) {
    // Over the heaviest band, it goes freight: the top band per 10kg.
    return Math.ceil(grams / 10000) * 1495;
  }
  return band.cents;
}

/** Shipping with the fuel surcharge applied once. */
export function shippingWithSurcharge(
  grams: number,
  surcharge: number,
): number {
  return applyRate(shippingCents(grams), surcharge);
}
