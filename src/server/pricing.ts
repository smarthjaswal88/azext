/**
 * Turns a browser-supplied list of variant ids and quantities into priced
 * lines and totals, entirely from the server catalog.
 *
 * The rule this module exists to enforce: nothing about money, availability or
 * product identity is ever taken from the request body. The request contributes
 * two things only — which variant, and how many.
 *
 * All arithmetic is in integer cents.
 */

import { clampQuantity, type LineIssue, type PricedCart, type PricedLine } from "@/lib/cart";
import { imagesForColor } from "@/lib/product";
import type { Product, Variant } from "@/lib/types";
import { getVariantById } from "./catalog";

/** Free delivery on the demo store. Kept explicit so the total is never just
 *  the subtotal by accident. */
const SHIPPING_CENTS = 0;

function optionsLabel(product: Product, variant: Variant): string {
  return product.optionAxes
    .map((axis) => axis.values.find((v) => v.id === variant.options[axis.key])?.label)
    .filter(Boolean)
    .join(" · ");
}

export interface RequestedItem {
  variantId: unknown;
  quantity: unknown;
}

/** Parses an untrusted request body into items. Returns undefined when the
 *  shape is wrong, which the route turns into a 400. */
export function parseRequestedItems(body: unknown): RequestedItem[] | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return undefined;
  if (items.length > 100) return undefined;
  return items.map((raw) => ({
    variantId: (raw as { variantId?: unknown } | null)?.variantId,
    quantity: (raw as { quantity?: unknown } | null)?.quantity,
  }));
}

export async function priceCart(requested: RequestedItem[]): Promise<PricedCart> {
  const lines: PricedLine[] = [];
  const issues: LineIssue[] = [];

  // Merge duplicates by variant id before pricing, so a client that sends the
  // same variant twice is charged once for the combined quantity.
  const merged = new Map<string, number>();
  for (const item of requested) {
    if (typeof item.variantId !== "string" || item.variantId.length === 0) {
      issues.push({
        variantId: String(item.variantId ?? ""),
        reason: "unknown_variant",
        detail: "Item had no variant id and was dropped.",
      });
      continue;
    }
    // Deliberately not clamped here — the raw amounts are summed and clamped
    // once, below. Clamping twice hides the cap: a single line of 99 would
    // become 10 here and then look like a legitimate 10 with nothing to report.
    const raw = Number(item.quantity);
    const valid = Number.isInteger(raw) && raw >= 1;
    if (!valid) {
      issues.push({
        variantId: item.variantId,
        reason: "invalid_quantity",
        detail: "Quantity was not a whole number of at least 1, so 1 was used.",
      });
    }
    const contribution = valid ? Math.min(raw, 1_000_000) : 1;
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + contribution);
  }

  for (const [variantId, rawQuantity] of merged) {
    const found = await getVariantById(variantId);
    if (!found) {
      issues.push({
        variantId,
        reason: "unknown_variant",
        detail: "That product option no longer exists in the catalog.",
      });
      continue;
    }

    const { quantity, capped } = clampQuantity(rawQuantity);
    if (capped) {
      issues.push({
        variantId,
        reason: "quantity_capped",
        detail: `Limited to ${quantity} per order.`,
      });
    }

    const { product, variant } = found;
    if (!variant.available) {
      issues.push({
        variantId,
        reason: "unavailable",
        detail: "This option is out of stock and is not included in the total.",
      });
    }

    const image = imagesForColor(product, variant.options.color)[0];
    lines.push({
      variantId,
      productSlug: product.slug,
      title: product.title,
      brand: product.brand,
      optionsLabel: optionsLabel(product, variant),
      imageSrc: image.src,
      imageAlt: image.alt,
      unitPriceCents: variant.priceCents,
      listPriceCents: variant.listPriceCents,
      quantity,
      lineTotalCents: variant.priceCents * quantity,
      available: variant.available,
    });
  }

  const purchasable = lines.filter((l) => l.available);
  const subtotalCents = purchasable.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = purchasable.length > 0 ? SHIPPING_CENTS : 0;

  return {
    lines,
    issues,
    itemCount: purchasable.reduce((sum, l) => sum + l.quantity, 0),
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: "USD",
  };
}
