"use client";

import { useState } from "react";
import type { CatalogVariant } from "@/lib/catalog-api";
import { formatPrice } from "@/lib/format";
import { optionsPricedText, type OptionCounts } from "@/lib/listing-highlights";

export function variantLabel(variant: CatalogVariant): string {
  return variant.label ?? (Object.values(variant.options).filter(Boolean).join(" · ") || "Standard option");
}

const INITIAL_VISIBLE = 12;

/**
 * Only purchasable options are offered — those with a listed USD price that
 * are not out of stock. The caller passes exactly those, and the listing's
 * option counts, so the options that cannot be chosen are explained: an
 * option without a price is never called out of stock.
 */
export function VariantPicker({
  options,
  selectedId,
  onSelect,
  counts,
}: {
  options: CatalogVariant[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  counts: OptionCounts;
}) {
  const unpriced = counts.total - counts.priced;
  const outOfStock = counts.priced - counts.purchasable;
  const [showAll, setShowAll] = useState(false);
  const selectedIndex = options.findIndex((v) => v.id === selectedId);
  const visible =
    showAll || options.length <= INITIAL_VISIBLE
      ? options
      : options.slice(0, Math.max(INITIAL_VISIBLE, selectedIndex + 1));

  return (
    <fieldset>
      <legend className="eyebrow">
        Options · <span className="normal-case tracking-normal">{optionsPricedText(counts)}</span>
      </legend>
      {options.length === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">
          No option of this listing has a price, so it cannot be added to the demo cart.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {visible.map((variant) => (
            <button
              key={variant.id}
              type="button"
              className="chip"
              aria-pressed={variant.id === selectedId}
              onClick={() => onSelect(variant.id)}
            >
              <span className="max-w-56 truncate">{variantLabel(variant)}</span>
              <span className="chip-count">{formatPrice(variant.priceCents as number)}</span>
            </button>
          ))}
          {visible.length < options.length && (
            <button type="button" className="chip" onClick={() => setShowAll(true)}>
              Show all {options.length}
            </button>
          )}
        </div>
      )}
      {unpriced > 0 && (
        <p className="mt-2 text-xs text-fg-subtle">
          {unpriced} {unpriced === 1 ? "option is" : "options are"} listed without a price and
          can&apos;t be selected.
        </p>
      )}
      {outOfStock > 0 && (
        <p className="mt-1 text-xs text-fg-subtle">
          {outOfStock} priced {outOfStock === 1 ? "option is" : "options are"} out of stock and
          can&apos;t be selected.
        </p>
      )}
    </fieldset>
  );
}
