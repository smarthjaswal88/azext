/** Formats integer cents as USD. Cents are the only money representation in
 *  this codebase; this is the single place they become a string. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Parses a user-entered dollar amount into cents. Returns undefined for blank
 *  or unparseable input so a bad filter value is ignored rather than throwing. */
export function parseDollarsToCents(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const n = Number(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}
