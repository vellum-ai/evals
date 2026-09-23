/** Format dollars as $1,234.56: comma thousands, always two decimals. */
export function formatUsd(amount: number): string {
  const cents = Math.round(amount * 100);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100).toString();
  const remainder = (absolute % 100).toString().padStart(2, "0");
  const grouped = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}.${remainder}`;
}

/** Add amounts in whole cents so repeated addition stays exact. */
export function sumUsd(amounts: number[]): number {
  const cents = amounts.reduce(
    (total, amount) => total + Math.round(amount * 100),
    0,
  );
  return cents / 100;
}
