/**
 * The supplier-quotes fixture: eight short quotes, and the arithmetic
 * they come to.
 *
 * The shape is the point. Eight files, each independent of the others,
 * each asking for the same small piece of work — the shape production
 * traces show an assistant fanning out over, one worker per item. Each
 * quote is about twenty lines and its total is three multiplications, so
 * the whole job is smaller than one briefing. Independence without
 * substance is exactly the case the delegation decision has to get
 * right.
 *
 * `generate.ts` writes the files from these definitions and prints the
 * totals. Regenerate rather than editing either side.
 */

/** One line on a quote. */
export interface QuoteLine {
  quantity: number;
  item: string;
  /** Unit price in dollars, as printed on the quote. */
  each: number;
}

/** One supplier's quote. */
export interface Quote {
  /** File basename under `quotes/`, without the extension. */
  slug: string;
  supplier: string;
  reference: string;
  received: string;
  lines: QuoteLine[];
  /** Working days until delivery, as printed. */
  leadDays: number;
  terms: string;
  note: string;
}

export const QUOTES: Quote[] = [
  {
    slug: "northwind-rigging",
    supplier: "Northwind Rigging",
    reference: "NR-2291",
    received: "3 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 41.5 },
      { quantity: 2, item: "Fender, medium", each: 28.0 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 139.0 },
    ],
    leadDays: 9,
    terms: "30 days net",
    note: "Prices hold for 30 days from the date above.",
  },
  {
    slug: "harbour-supply-co",
    supplier: "Harbour Supply Co",
    reference: "HSC-8814",
    received: "3 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 38.75 },
      { quantity: 2, item: "Fender, medium", each: 31.5 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 152.0 },
    ],
    leadDays: 14,
    terms: "30 days net",
    note: "Carriage included on orders over $250.",
  },
  {
    slug: "gullwing-marine",
    supplier: "Gullwing Marine",
    reference: "GM-0447",
    received: "4 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 44.0 },
      { quantity: 2, item: "Fender, medium", each: 24.25 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 128.5 },
    ],
    leadDays: 6,
    terms: "Payment with order",
    note: "Bilge pumps are last of the line; no restock after these.",
  },
  {
    slug: "tidewater-chandlery",
    supplier: "Tidewater Chandlery",
    reference: "TC-1150",
    received: "4 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 39.95 },
      { quantity: 2, item: "Fender, medium", each: 29.95 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 144.0 },
    ],
    leadDays: 21,
    terms: "60 days net",
    note: "Lead time is from receipt of a signed order.",
  },
  {
    slug: "kestrel-marine-parts",
    supplier: "Kestrel Marine Parts",
    reference: "KMP-6032",
    received: "5 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 42.0 },
      { quantity: 2, item: "Fender, medium", each: 26.5 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 133.75 },
    ],
    leadDays: 11,
    terms: "30 days net",
    note: "Substitutes offered if the pump is out of stock.",
  },
  {
    slug: "pelican-trading",
    supplier: "Pelican Trading",
    reference: "PT-3308",
    received: "5 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 36.5 },
      { quantity: 2, item: "Fender, medium", each: 34.0 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 161.25 },
    ],
    leadDays: 8,
    terms: "Payment with order",
    note: "Dock line is a house brand, not the brand quoted elsewhere.",
  },
  {
    slug: "saltbox-marine",
    supplier: "Saltbox Marine",
    reference: "SM-9071",
    received: "6 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 40.25 },
      { quantity: 2, item: "Fender, medium", each: 27.75 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 149.5 },
    ],
    leadDays: 5,
    terms: "30 days net",
    note: "Delivery is to the yard gate, not the pontoon.",
  },
  {
    slug: "orkney-boatworks",
    supplier: "Orkney Boatworks",
    reference: "OB-5529",
    received: "6 March",
    lines: [
      { quantity: 6, item: "Dock line, 12m", each: 43.5 },
      { quantity: 2, item: "Fender, medium", each: 22.0 },
      { quantity: 1, item: "Bilge pump, 800gph", each: 141.0 },
    ],
    leadDays: 30,
    terms: "30 days net",
    note: "Quoted lead time is long because the pump ships from the mainland.",
  },
];

/** What one quote comes to, in cents, so the arithmetic never drifts. */
export function quoteTotalCents(quote: Quote): number {
  return quote.lines.reduce(
    (total, line) => total + Math.round(line.each * 100) * line.quantity,
    0,
  );
}

/** Cents as `$1,234.56`. */
export function formatUsd(cents: number): string {
  const whole = Math.floor(cents / 100).toLocaleString("en-US");
  const part = String(cents % 100).padStart(2, "0");
  return `$${whole}.${part}`;
}
