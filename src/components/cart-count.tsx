"use client";

import Link from "next/link";
import { useCartItems } from "@/lib/cart-store";

/** Renders the same markup as the server until localStorage has been read, so
 *  there is no hydration mismatch and no moment where a returning shopper is
 *  told their cart is empty. */
export function CartCount() {
  const items = useCartItems();
  const count = items?.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link
      href="/cart"
      className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-white/10"
    >
      <span aria-hidden="true">🛒</span>
      <span>Cart</span>
      <span
        aria-hidden={count === undefined}
        className="min-w-6 rounded-full bg-accent px-1.5 py-0.5 text-center text-xs font-bold text-accent-ink"
      >
        {count ?? "–"}
      </span>
      <span className="sr-only">
        {count === undefined ? "Cart contents loading" : `${count} items in cart`}
      </span>
    </Link>
  );
}
