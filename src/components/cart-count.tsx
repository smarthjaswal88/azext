"use client";

import Link from "next/link";
import { useCartItems } from "@/lib/cart-store";
import { CartIcon } from "./icons";

/** Renders the same markup as the server until the client takes over, so there
 *  is no hydration mismatch and no moment where a returning shopper is told
 *  their cart is empty. */
export function CartCount() {
  const items = useCartItems();
  const count = items?.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link
      href="/cart"
      className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 hover:bg-white/10"
    >
      <span className="relative inline-flex">
        <CartIcon size={24} />
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-1.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-accent-ink"
        >
          {count ?? "–"}
        </span>
      </span>
      <span className="hidden text-sm font-medium sm:inline">Cart</span>
      <span className="sr-only">
        {count === undefined ? "Cart contents loading" : `${count} items in cart`}
      </span>
    </Link>
  );
}
