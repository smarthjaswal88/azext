"use client";

import { useState } from "react";
import { useCartItems, useCartStore } from "@/lib/cart-store";

/**
 * Add to cart from within a comparison column, using the same cart store as
 * everywhere else — there is no second cart path.
 *
 * A garment with no size chosen cannot be added. The button says why rather
 * than guessing a size on the shopper's behalf.
 */
export function CompareAddToCart({
  variantId,
  available,
  needsSize,
}: {
  variantId?: string;
  available: boolean;
  needsSize: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const ready = useCartItems() !== undefined;
  const [added, setAdded] = useState(false);

  if (needsSize) {
    return (
      <p className="rounded-md border border-border-strong bg-surface-muted px-3 py-2 text-center text-xs font-medium text-ink-muted">
        Choose a size to add this to the cart
      </p>
    );
  }

  if (!variantId || !available) {
    return (
      <p className="rounded-md border border-border-subtle bg-surface-muted px-3 py-2 text-center text-xs font-medium text-ink-muted">
        This option is unavailable
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => {
        addItem(variantId, 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 2500);
      }}
      className="w-full rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-hover disabled:opacity-60"
    >
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
