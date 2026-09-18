/** Shapes shared by the cart store, the pricing route and the checkout UI.
 *
 *  The browser only ever sends variant ids and quantities. Prices, availability
 *  and totals are resolved on the server from the catalog and sent back — the
 *  client never supplies money. */

export const MAX_QUANTITY_PER_LINE = 10;

/** What localStorage holds. Deliberately tiny: no prices, no titles, nothing
 *  that could go stale or be tampered with to change what is charged. */
export interface CartItem {
  variantId: string;
  quantity: number;
}

export interface PricedLine {
  variantId: string;
  productSlug: string;
  title: string;
  brand: string;
  /** e.g. "Midnight · Large" */
  optionsLabel: string;
  imageSrc: string;
  imageAlt: string;
  unitPriceCents: number;
  listPriceCents?: number;
  quantity: number;
  lineTotalCents: number;
  available: boolean;
}

export type LineIssueReason =
  | "unknown_variant"
  | "invalid_quantity"
  | "quantity_capped"
  | "unavailable";

export interface LineIssue {
  variantId: string;
  reason: LineIssueReason;
  detail: string;
}

export interface PricedCart {
  lines: PricedLine[];
  issues: LineIssue[];
  /** Purchasable lines only — unavailable lines are excluded from all money. */
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: "USD";
}

export function clampQuantity(raw: unknown): { quantity: number; capped: boolean; valid: boolean } {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { quantity: 1, capped: false, valid: false };
  }
  if (n > MAX_QUANTITY_PER_LINE) {
    return { quantity: MAX_QUANTITY_PER_LINE, capped: true, valid: true };
  }
  return { quantity: n, capped: false, valid: true };
}
