const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** True for a YYYY-MM-DD date with a plausible month and day. */
export function isValidDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** True for a YYYY-MM month key. */
export function isValidMonth(value: string): boolean {
  const match = MONTH_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/** The YYYY-MM month a YYYY-MM-DD date belongs to. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}
