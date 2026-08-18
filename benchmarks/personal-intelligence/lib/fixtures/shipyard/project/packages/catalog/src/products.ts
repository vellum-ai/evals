import { toCents } from "../../core/src/money";

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
    throw new Error(`Unknown sku: ${sku}`);
  }
  return toCents(product.dollars);
}
