"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart";
import { useCartItems, useCartStore } from "@/lib/cart-store";
import { BagIcon, CheckIcon } from "../icons";

/**
 * Adds the selected option to the demo cart. Only the variant id and a
 * quantity are stored; the cart and checkout price everything again on the
 * server from the catalog.
 */
export function AddToDemoCart({ variantId, disabled }: { variantId: string | undefined; disabled: boolean }) {
  const id = useId();
  const addItem = useCartStore((s) => s.addItem);
  const ready = useCartItems() !== undefined;
  const [quantity, setQuantity] = useState(1);
  const [addedFor, setAddedFor] = useState<string>();

  const canAdd = ready && !disabled && variantId !== undefined;
  const added = addedFor !== undefined && addedFor === variantId;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`${id}-qty`} className="eyebrow block">
          Quantity
        </label>
        <select
          id={`${id}-qty`}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          disabled={!canAdd}
          className="field mt-2 w-24"
        >
          {Array.from({ length: MAX_QUANTITY_PER_LINE }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => {
          if (!variantId) return;
          addItem(variantId, quantity);
          setAddedFor(variantId);
        }}
        className="btn btn-primary min-w-48 flex-1"
      >
        {added ? <CheckIcon size={16} /> : <BagIcon size={16} />}
        {added ? "Added to demo cart" : "Add to demo cart"}
      </button>
      {added && (
        <p role="status" className="w-full text-sm text-fg-muted">
          Added.{" "}
          <Link href="/cart" className="link">
            View demo cart
          </Link>
        </p>
      )}
    </div>
  );
}
