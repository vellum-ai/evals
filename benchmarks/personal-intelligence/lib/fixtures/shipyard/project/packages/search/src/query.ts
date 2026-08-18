import { listProducts, type Product } from "../../catalog/src/products";

/** Normalize a shopper's typing: case and spacing do not matter. */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
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
