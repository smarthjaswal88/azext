"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart";
import { useCartItems, useCartStore } from "@/lib/cart-store";

/** Add to cart and Buy now for the selected variant.
 *
 *  Buy now deliberately does not touch the cart: it sends just this selection
 *  to checkout, so an unrelated cart is neither cleared nor bought by accident.
 *
 *  Both controls are only rendered when the selected variant is purchasable —
 *  see the caller. */
export function AddToCart({
  variantId,
  available,
}: {
  variantId: string;
  available: boolean;
}) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  // undefined until the client takes over, which also keeps the button from
  // being clickable before the persisted cart has been read.
  const ready = useCartItems() !== undefined;
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!available) {
    return (
      <p className="mt-4 rounded-md border border-border-subtle bg-surface-muted p-3 text-sm text-ink-muted">
        This option cannot be added to the cart while it is unavailable. Choose another above.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-ink-muted">Quantity</span>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="rounded border border-border-strong bg-surface px-2 py-1"
        >
          {Array.from({ length: MAX_QUANTITY_PER_LINE }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          addItem(variantId, quantity);
          setAdded(true);
          window.setTimeout(() => setAdded(false), 2500);
        }}
        className="w-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-hover disabled:opacity-60"
      >
        {added ? "Added to cart ✓" : "Add to cart"}
      </button>

      <button
        type="button"
        disabled={!ready}
        onClick={() =>
          router.push(`/checkout?variant=${encodeURIComponent(variantId)}&qty=${quantity}`)
        }
        className="w-full rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-60"
      >
        Buy now
      </button>

      <p className="text-xs text-ink-muted">
        Buy now checks out this item only and leaves your cart untouched.
      </p>
    </div>
  );
}
