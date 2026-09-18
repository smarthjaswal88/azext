/**
 * Demo order persistence. Server only — see ./supabase.ts for why.
 *
 * When Supabase is not configured these functions report that plainly. They
 * never fall back to an in-memory store: an order that disappears on the next
 * restart would look like it worked and would not be there when the shopper
 * came back.
 */

import { randomBytes } from "node:crypto";
import type { PricedCart } from "@/lib/cart";
import { getServiceClient, missingSupabaseVars } from "./supabase";

/** Fixed demo delivery details, so a reviewer can complete the journey without
 *  typing anything about themselves. Nothing here is a real address. */
export const DEMO_DELIVERY = {
  name: "Demo Shopper",
  line1: "1 Prototype Way",
  line2: "Sample District",
  city: "Springfield",
  region: "IL",
  postalCode: "62704",
  country: "United States",
  method: "Demo delivery — nothing ships",
} as const;

export interface StoredOrderItem {
  variantId: string;
  productSlug: string;
  title: string;
  optionsLabel: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface StoredOrder {
  confirmationToken: string;
  status: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  delivery: typeof DEMO_DELIVERY;
  createdAt: string;
  items: StoredOrderItem[];
}

export type CreateOrderResult =
  | { status: "ok"; confirmationToken: string }
  | { status: "unconfigured"; missing: string[] }
  | { status: "error"; message: string };

/** 32 random bytes, URL-safe. Long enough that guessing another shopper's
 *  confirmation link is not a realistic attack. */
function newConfirmationToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createDemoOrder(
  idempotencyKey: string,
  priced: PricedCart,
): Promise<CreateOrderResult> {
  const supabase = getServiceClient();
  if (!supabase) return { status: "unconfigured", missing: missingSupabaseVars() };

  const purchasable = priced.lines.filter((l) => l.available);
  if (purchasable.length === 0) {
    return { status: "error", message: "There is nothing purchasable in this order." };
  }

  // The database function does the insert and the items in one transaction and
  // ignores a repeated idempotency key, returning the original token.
  const { data, error } = await supabase.rpc("create_demo_order", {
    p_idempotency_key: idempotencyKey,
    p_confirmation_token: newConfirmationToken(),
    p_currency: priced.currency,
    p_subtotal_cents: priced.subtotalCents,
    p_shipping_cents: priced.shippingCents,
    p_total_cents: priced.totalCents,
    p_delivery: DEMO_DELIVERY,
    p_items: purchasable.map((l) => ({
      variant_id: l.variantId,
      product_slug: l.productSlug,
      title: l.title,
      options_label: l.optionsLabel,
      unit_price_cents: l.unitPriceCents,
      quantity: l.quantity,
      line_total_cents: l.lineTotalCents,
    })),
  });

  if (error) return { status: "error", message: error.message };
  if (typeof data !== "string" || data.length === 0) {
    return { status: "error", message: "The database did not return a confirmation token." };
  }
  return { status: "ok", confirmationToken: data };
}

export type LookupOrderResult =
  | { status: "ok"; order: StoredOrder }
  | { status: "not_found" }
  | { status: "unconfigured"; missing: string[] }
  | { status: "error"; message: string };

export async function getOrderByToken(token: string): Promise<LookupOrderResult> {
  const supabase = getServiceClient();
  if (!supabase) return { status: "unconfigured", missing: missingSupabaseVars() };

  const { data, error } = await supabase
    .from("orders")
    .select(
      "confirmation_token, status, currency, subtotal_cents, shipping_cents, total_cents, delivery, created_at, order_items(variant_id, product_slug, title, options_label, unit_price_cents, quantity, line_total_cents)",
    )
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "not_found" };

  const row = data as unknown as {
    confirmation_token: string;
    status: string;
    currency: string;
    subtotal_cents: number;
    shipping_cents: number;
    total_cents: number;
    delivery: typeof DEMO_DELIVERY;
    created_at: string;
    order_items: Array<{
      variant_id: string;
      product_slug: string;
      title: string;
      options_label: string;
      unit_price_cents: number;
      quantity: number;
      line_total_cents: number;
    }>;
  };

  return {
    status: "ok",
    order: {
      confirmationToken: row.confirmation_token,
      status: row.status,
      currency: row.currency,
      subtotalCents: row.subtotal_cents,
      shippingCents: row.shipping_cents,
      totalCents: row.total_cents,
      delivery: row.delivery,
      createdAt: row.created_at,
      items: row.order_items.map((i) => ({
        variantId: i.variant_id,
        productSlug: i.product_slug,
        title: i.title,
        optionsLabel: i.options_label,
        unitPriceCents: i.unit_price_cents,
        quantity: i.quantity,
        lineTotalCents: i.line_total_cents,
      })),
    },
  };
}
