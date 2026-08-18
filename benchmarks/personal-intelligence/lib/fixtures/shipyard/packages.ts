/**
 * The shipyard fixture's package definitions: the source of truth the
 * generator writes `project/` from.
 *
 * The repository exists to be WIDE. One package per slice of the shop,
 * each with its own module and its own test file, is the shape that
 * invites an assistant to split the work up one worker per package —
 * while the defect that makes the check fail sits in exactly one of them
 * and the check names it on the first run. Breadth is the temptation;
 * the cheap path is one command.
 *
 * Every package is real, runnable code with passing tests. Only
 * `invoicing` carries the planted defect (see `DEFECT` below), so the
 * rest are honest scenery: an assistant that reads them learns the house
 * pattern it should have applied.
 */

/** One package in the generated monorepo. */
export interface PackageDef {
  /** Directory name under `packages/`, and the second half of its name. */
  name: string;
  /** One-line purpose, used in its README line and package.json. */
  summary: string;
  /** The module file's basename (no extension). */
  module: string;
  /** The module source, already formatted. */
  source: string;
  /** The test source, already formatted. */
  test: string;
}

/**
 * The shared money helpers every package is supposed to use. Lives in
 * `packages/core` and is imported by relative path — the fixture runs
 * with no install step, so there are no workspace symlinks to resolve.
 */
const CORE_MONEY = `/** Money is integer cents everywhere. Floats never cross a boundary. */

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

/** Cents as \`$1,234.56\`. */
export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const part = String(abs % 100).padStart(2, "0");
  return \`\${sign}$\${whole}.\${part}\`;
}
`;

const CORE_MONEY_TEST = `import { describe, expect, test } from "bun:test";

import { applyRate, formatUsd, sumCents, toCents } from "./money";

describe("money", () => {
  test("dollars convert to cents once", () => {
    expect(toCents(3.33)).toBe(333);
    expect(toCents(0.1)).toBe(10);
  });

  test("cents sum as integers", () => {
    expect(sumCents([333, 333, 333])).toBe(999);
    expect(sumCents([])).toBe(0);
  });

  test("a rate rounds once, at the end", () => {
    // 999 * 1.10 = 1098.9 -> 1099. Rounding each 333 first gives 1098.
    expect(applyRate(999, 0.1)).toBe(1099);
  });

  test("cents format as dollars", () => {
    expect(formatUsd(1099)).toBe("$10.99");
    expect(formatUsd(123456)).toBe("$1,234.56");
    expect(formatUsd(-500)).toBe("-$5.00");
  });
});
`;

/**
 * Where the defect is, and what it costs.
 *
 * `invoicing` applies the tax rate line by line and rounds each line,
 * instead of applying it once to the subtotal the way `core.applyRate`
 * does and every other package does. Three $3.33 lines at 10% come to
 * $10.98 instead of $10.99 — one cent, one line of code, one package.
 */
export const DEFECT = {
  package: "invoicing",
  file: "packages/invoicing/src/invoice.ts",
  /** What the failing test expects, in cents. */
  expectedCents: 1099,
  /** What the defective code produces, in cents. */
  actualCents: 1098,
} as const;

export const PACKAGES: PackageDef[] = [
  {
    name: "core",
    summary: "Shared money helpers every other package builds on",
    module: "money",
    source: CORE_MONEY,
    test: CORE_MONEY_TEST,
  },
  {
    name: "invoicing",
    summary: "Turns line items into an invoice total",
    module: "invoice",
    source: `import { formatUsd, toCents } from "../../core/src/money";

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
  const taxed = lines.map((line) => Math.round(lineCents(line) * (1 + taxRate)));
  return taxed.reduce((total, value) => total + value, 0);
}

/** The invoice total, ready to print. */
export function renderTotal(lines: Line[], taxRate: number): string {
  return formatUsd(invoiceTotal(lines, taxRate));
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { invoiceTotal, lineCents, renderTotal, type Line } from "./invoice";

const THREE_SMALL_LINES: Line[] = [
  { description: "Rope, 20m", dollars: 3.33, quantity: 1 },
  { description: "Deck cleat", dollars: 3.33, quantity: 1 },
  { description: "Shackle, 8mm", dollars: 3.33, quantity: 1 },
];

describe("invoice", () => {
  test("a line is its unit price times its quantity", () => {
    expect(lineCents({ description: "Sail tape", dollars: 12.5, quantity: 4 })).toBe(5000);
  });

  test("tax is charged on what the customer actually owes", () => {
    // Subtotal $9.99, tax 10%: $10.989 -> $10.99 on the invoice.
    expect(invoiceTotal(THREE_SMALL_LINES, 0.1)).toBe(1099);
  });

  test("the printed total reads as dollars", () => {
    expect(renderTotal(THREE_SMALL_LINES, 0.1)).toBe("$10.99");
  });
});
`,
  },
  {
    name: "billing",
    summary: "Charges a customer's card for an invoice",
    module: "charge",
    source: `import { applyRate, formatUsd } from "../../core/src/money";

/** A charge as the payment processor would take it. */
export interface Charge {
  invoiceId: string;
  cents: number;
  currency: "usd";
}

/** Build a charge for an invoice total, with the processor's surcharge. */
export function buildCharge(invoiceId: string, subtotalCents: number, surcharge: number): Charge {
  return { invoiceId, cents: applyRate(subtotalCents, surcharge), currency: "usd" };
}

/** What the customer sees on the statement. */
export function describeCharge(charge: Charge): string {
  return \`\${charge.invoiceId} \${formatUsd(charge.cents)}\`;
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { buildCharge, describeCharge } from "./charge";

describe("charge", () => {
  test("the surcharge rounds once", () => {
    expect(buildCharge("INV-1", 999, 0.1).cents).toBe(1099);
  });

  test("a statement line names the invoice", () => {
    expect(describeCharge(buildCharge("INV-2", 2500, 0))).toBe("INV-2 $25.00");
  });
});
`,
  },
  {
    name: "catalog",
    summary: "The products the shop sells and what they cost",
    module: "products",
    source: `import { toCents } from "../../core/src/money";

/** A thing the shop sells. */
export interface Product {
  sku: string;
  title: string;
  dollars: number;
  tags: string[];
}

const PRODUCTS: Product[] = [
  { sku: "RP-020", title: "Rope, 20m", dollars: 3.33, tags: ["rigging"] },
  { sku: "DC-001", title: "Deck cleat", dollars: 3.33, tags: ["deck"] },
  { sku: "SH-008", title: "Shackle, 8mm", dollars: 3.33, tags: ["rigging"] },
  { sku: "ST-050", title: "Sail tape, 50mm", dollars: 12.5, tags: ["repair"] },
  { sku: "AN-010", title: "Anchor, 10kg", dollars: 189.0, tags: ["ground"] },
];

/** Every product, in catalogue order. */
export function listProducts(): Product[] {
  return [...PRODUCTS];
}

/** One product by sku, or undefined when the shop does not stock it. */
export function findProduct(sku: string): Product | undefined {
  return PRODUCTS.find((product) => product.sku === sku);
}

/** A product's price in cents. */
export function priceCents(sku: string): number {
  const product = findProduct(sku);
  if (product === undefined) {
    throw new Error(\`Unknown sku: \${sku}\`);
  }
  return toCents(product.dollars);
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { findProduct, listProducts, priceCents } from "./products";

describe("products", () => {
  test("the catalogue lists what the shop stocks", () => {
    expect(listProducts()).toHaveLength(5);
  });

  test("a sku resolves to its price in cents", () => {
    expect(priceCents("RP-020")).toBe(333);
    expect(priceCents("AN-010")).toBe(18900);
  });

  test("an unknown sku is an error, not a zero", () => {
    expect(findProduct("NOPE")).toBeUndefined();
    expect(() => priceCents("NOPE")).toThrow("Unknown sku");
  });
});
`,
  },
  {
    name: "checkout",
    summary: "Turns a basket into an order",
    module: "basket",
    source: `import { sumCents } from "../../core/src/money";
import { priceCents } from "../../catalog/src/products";

/** What a shopper has picked up. */
export interface BasketItem {
  sku: string;
  quantity: number;
}

/** The basket subtotal in cents. */
export function basketSubtotal(items: BasketItem[]): number {
  return sumCents(items.map((item) => priceCents(item.sku) * item.quantity));
}

/** A basket with nothing in it is not an order. */
export function isOrderable(items: BasketItem[]): boolean {
  return items.length > 0 && items.every((item) => item.quantity > 0);
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { basketSubtotal, isOrderable } from "./basket";

describe("basket", () => {
  test("a subtotal adds up the lines", () => {
    expect(basketSubtotal([{ sku: "RP-020", quantity: 3 }])).toBe(999);
  });

  test("an empty basket is not orderable", () => {
    expect(isOrderable([])).toBe(false);
    expect(isOrderable([{ sku: "RP-020", quantity: 0 }])).toBe(false);
    expect(isOrderable([{ sku: "RP-020", quantity: 1 }])).toBe(true);
  });
});
`,
  },
  {
    name: "shipping",
    summary: "What it costs to send an order out",
    module: "rates",
    source: `import { applyRate } from "../../core/src/money";

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
export function shippingWithSurcharge(grams: number, surcharge: number): number {
  return applyRate(shippingCents(grams), surcharge);
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { shippingCents, shippingWithSurcharge } from "./rates";

describe("rates", () => {
  test("a parcel falls into its band", () => {
    expect(shippingCents(300)).toBe(495);
    expect(shippingCents(500)).toBe(495);
    expect(shippingCents(1900)).toBe(795);
  });

  test("anything over the top band ships freight", () => {
    expect(shippingCents(25000)).toBe(4485);
  });

  test("the surcharge applies to the band price", () => {
    expect(shippingWithSurcharge(300, 0.1)).toBe(545);
  });
});
`,
  },
  {
    name: "inventory",
    summary: "What is on the shelf and what is spoken for",
    module: "stock",
    source: `/** What the shop holds of one sku. */
export interface StockLevel {
  sku: string;
  onHand: number;
  reserved: number;
}

/** What can still be sold: on hand less what is already spoken for. */
export function available(level: StockLevel): number {
  return Math.max(0, level.onHand - level.reserved);
}

/** Reserve stock for an order, or report why it cannot be reserved. */
export function reserve(level: StockLevel, quantity: number): StockLevel {
  if (quantity <= 0) {
    throw new Error("Reserve a positive quantity.");
  }
  if (available(level) < quantity) {
    throw new Error(\`Only \${available(level)} of \${level.sku} available.\`);
  }
  return { ...level, reserved: level.reserved + quantity };
}

/** Release a reservation an order no longer needs. */
export function release(level: StockLevel, quantity: number): StockLevel {
  return { ...level, reserved: Math.max(0, level.reserved - quantity) };
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { available, release, reserve } from "./stock";

const LEVEL = { sku: "RP-020", onHand: 10, reserved: 2 };

describe("stock", () => {
  test("availability is on hand less reserved", () => {
    expect(available(LEVEL)).toBe(8);
  });

  test("reserving what is there moves it to reserved", () => {
    expect(reserve(LEVEL, 3).reserved).toBe(5);
  });

  test("reserving more than there is fails loudly", () => {
    expect(() => reserve(LEVEL, 9)).toThrow("Only 8");
  });

  test("releasing never goes below zero", () => {
    expect(release(LEVEL, 5).reserved).toBe(0);
  });
});
`,
  },
  {
    name: "notifications",
    summary: "The messages the shop sends its customers",
    module: "messages",
    source: `import { formatUsd } from "../../core/src/money";

/** An outbound message, ready to hand to a transport. */
export interface Message {
  to: string;
  subject: string;
  body: string;
}

/** Tell a customer their order is on its way. */
export function shippedMessage(to: string, orderId: string, tracking: string): Message {
  return {
    to,
    subject: \`Order \${orderId} is on its way\`,
    body: \`Your order \${orderId} shipped today. Tracking: \${tracking}.\`,
  };
}

/** Tell a customer what they were charged. */
export function receiptMessage(to: string, orderId: string, cents: number): Message {
  return {
    to,
    subject: \`Receipt for \${orderId}\`,
    body: \`We charged \${formatUsd(cents)} for order \${orderId}.\`,
  };
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { receiptMessage, shippedMessage } from "./messages";

describe("messages", () => {
  test("a shipping note carries the tracking number", () => {
    const message = shippedMessage("skipper@example.test", "ORD-9", "TRK-1");
    expect(message.subject).toBe("Order ORD-9 is on its way");
    expect(message.body).toContain("TRK-1");
  });

  test("a receipt states the amount as dollars", () => {
    expect(receiptMessage("skipper@example.test", "ORD-9", 1099).body).toContain("$10.99");
  });
});
`,
  },
  {
    name: "reporting",
    summary: "Daily totals for whoever is minding the shop",
    module: "daily",
    source: `import { formatUsd, sumCents } from "../../core/src/money";

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
  return \`\${kept} order(s), \${formatUsd(dayTotal(rows))}\`;
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { dayTotal, daySummary } from "./daily";

const ROWS = [
  { orderId: "ORD-1", cents: 1099, refunded: false },
  { orderId: "ORD-2", cents: 2500, refunded: true },
  { orderId: "ORD-3", cents: 495, refunded: false },
];

describe("daily", () => {
  test("refunds do not count toward the day", () => {
    expect(dayTotal(ROWS)).toBe(1594);
  });

  test("the summary counts the orders it kept", () => {
    expect(daySummary(ROWS)).toBe("2 order(s), $15.94");
  });
});
`,
  },
  {
    name: "scheduling",
    summary: "When the van goes out and what is on it",
    module: "runs",
    source: `/** A delivery run on a given weekday. */
export interface Run {
  day: "mon" | "tue" | "wed" | "thu" | "fri";
  capacity: number;
  booked: number;
}

/** Can this run take one more parcel? */
export function hasRoom(run: Run): boolean {
  return run.booked < run.capacity;
}

/** Book a parcel onto the first run of the week with room. */
export function bookNext(runs: Run[]): Run[] {
  const index = runs.findIndex(hasRoom);
  if (index === -1) {
    throw new Error("Every run this week is full.");
  }
  return runs.map((run, position) =>
    position === index ? { ...run, booked: run.booked + 1 } : run,
  );
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { bookNext, hasRoom, type Run } from "./runs";

const WEEK: Run[] = [
  { day: "mon", capacity: 2, booked: 2 },
  { day: "tue", capacity: 2, booked: 1 },
  { day: "wed", capacity: 2, booked: 0 },
];

describe("runs", () => {
  test("a full run has no room", () => {
    expect(hasRoom(WEEK[0])).toBe(false);
    expect(hasRoom(WEEK[1])).toBe(true);
  });

  test("booking takes the first run with room", () => {
    expect(bookNext(WEEK)[1].booked).toBe(2);
  });

  test("a full week refuses the booking", () => {
    expect(() => bookNext([{ day: "fri", capacity: 1, booked: 1 }])).toThrow("full");
  });
});
`,
  },
  {
    name: "auth",
    summary: "Who is allowed to open the till",
    module: "sessions",
    source: `/** A staff session, as the till understands it. */
export interface Session {
  user: string;
  role: "owner" | "staff" | "reader";
  issuedAt: number;
}

const HOUR_MS = 60 * 60 * 1000;

/** A session is good for eight hours. */
export function isActive(session: Session, now: number): boolean {
  return now - session.issuedAt < 8 * HOUR_MS;
}

/** Only the owner and staff can take money. */
export function canTakePayment(session: Session, now: number): boolean {
  return isActive(session, now) && session.role !== "reader";
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { canTakePayment, isActive, type Session } from "./sessions";

const NOW = 1_700_000_000_000;
const session = (role: Session["role"], ageHours: number): Session => ({
  user: "sam",
  role,
  issuedAt: NOW - ageHours * 60 * 60 * 1000,
});

describe("sessions", () => {
  test("a session lapses after eight hours", () => {
    expect(isActive(session("staff", 7), NOW)).toBe(true);
    expect(isActive(session("staff", 9), NOW)).toBe(false);
  });

  test("a reader may not take payment", () => {
    expect(canTakePayment(session("reader", 1), NOW)).toBe(false);
    expect(canTakePayment(session("staff", 1), NOW)).toBe(true);
  });
});
`,
  },
  {
    name: "audit",
    summary: "The trail of who changed what",
    module: "trail",
    source: `/** One recorded action. */
export interface Entry {
  at: number;
  actor: string;
  action: string;
}

/** Append an entry, newest last. */
export function record(trail: Entry[], entry: Entry): Entry[] {
  return [...trail, entry];
}

/** Everything one actor did, oldest first. */
export function byActor(trail: Entry[], actor: string): Entry[] {
  return trail.filter((entry) => entry.actor === actor).sort((a, b) => a.at - b.at);
}

/** The last thing that happened, if anything has. */
export function latest(trail: Entry[]): Entry | undefined {
  return trail.reduce<Entry | undefined>(
    (newest, entry) => (newest === undefined || entry.at > newest.at ? entry : newest),
    undefined,
  );
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { byActor, latest, record } from "./trail";

const TRAIL = [
  { at: 3, actor: "sam", action: "refund" },
  { at: 1, actor: "kim", action: "login" },
  { at: 2, actor: "sam", action: "login" },
];

describe("trail", () => {
  test("recording appends", () => {
    expect(record(TRAIL, { at: 4, actor: "kim", action: "logout" })).toHaveLength(4);
  });

  test("one actor's entries come back oldest first", () => {
    expect(byActor(TRAIL, "sam").map((entry) => entry.at)).toEqual([2, 3]);
  });

  test("the latest entry is the newest one", () => {
    expect(latest(TRAIL)?.action).toBe("refund");
    expect(latest([])).toBeUndefined();
  });
});
`,
  },
  {
    name: "returns",
    summary: "Taking something back and paying it out",
    module: "refunds",
    source: `import { formatUsd, sumCents } from "../../core/src/money";

/** A line the customer is sending back. */
export interface ReturnLine {
  sku: string;
  cents: number;
  restocked: boolean;
}

/** What goes back on the card: only what came back on the shelf. */
export function refundCents(lines: ReturnLine[]): number {
  return sumCents(lines.filter((line) => line.restocked).map((line) => line.cents));
}

/** What the customer is told they are getting back. */
export function refundNote(lines: ReturnLine[]): string {
  return \`Refunding \${formatUsd(refundCents(lines))}\`;
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { refundCents, refundNote } from "./refunds";

const LINES = [
  { sku: "RP-020", cents: 333, restocked: true },
  { sku: "DC-001", cents: 333, restocked: false },
  { sku: "SH-008", cents: 333, restocked: true },
];

describe("refunds", () => {
  test("only restocked lines are refunded", () => {
    expect(refundCents(LINES)).toBe(666);
  });

  test("the note states the amount", () => {
    expect(refundNote(LINES)).toBe("Refunding $6.66");
  });
});
`,
  },
  {
    name: "search",
    summary: "Finding a product by what a shopper typed",
    module: "query",
    source: `import { listProducts, type Product } from "../../catalog/src/products";

/** Normalize a shopper's typing: case and spacing do not matter. */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\\s+/g, " ");
}

/** Products whose title or tags contain what was typed. */
export function search(text: string): Product[] {
  const needle = normalize(text);
  if (needle === "") {
    return [];
  }
  return listProducts().filter(
    (product) =>
      normalize(product.title).includes(needle) ||
      product.tags.some((tag) => normalize(tag).includes(needle)),
  );
}

/** The skus a search matched, in catalogue order. */
export function searchSkus(text: string): string[] {
  return search(text).map((product) => product.sku);
}
`,
    test: `import { describe, expect, test } from "bun:test";

import { search, searchSkus } from "./query";

describe("query", () => {
  test("a title match ignores case and spacing", () => {
    expect(searchSkus("  DECK  cleat ")).toEqual(["DC-001"]);
  });

  test("a tag matches too", () => {
    expect(searchSkus("rigging")).toEqual(["RP-020", "SH-008"]);
  });

  test("an empty search matches nothing", () => {
    expect(search("")).toHaveLength(0);
  });
});
`,
  },
];
