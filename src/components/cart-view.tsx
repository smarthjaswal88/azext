"use client";

import Image from "next/image";
import Link from "next/link";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart";
import { useCartItems, useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { useCartSummary } from "@/lib/use-cart-summary";

export function CartView() {
  const stored = useCartItems();
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const items = stored ?? [];
  const { data, error, loading, reload } = useCartSummary(items, stored !== undefined);

  if (stored === undefined) {
    return <p className="rounded-lg border border-border-subtle bg-surface py-16 text-center text-ink-muted">Loading your cart…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-12 text-center">
        <h2 className="text-lg font-medium">Your cart is empty</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Nothing here yet. Browse the catalog and add something to see it appear.
        </p>
        <Link
          href="/search"
          className="mt-5 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-hover"
        >
          Browse all products
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
        <p className="font-medium text-sale">We could not price your cart.</p>
        <p className="mt-1 text-sm text-ink-muted">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-4 rounded-md border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-surface-muted"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className="rounded-lg border border-border-subtle bg-surface py-16 text-center text-ink-muted">Pricing your cart…</p>;
  }

  const unavailable = data.lines.filter((l) => !l.available);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section aria-labelledby="cart-lines-heading" className="rounded-lg border border-border-subtle bg-surface p-3 sm:p-4">
        <h2 id="cart-lines-heading" className="sr-only">
          Items in your cart
        </h2>

        {data.issues.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-md border border-border-subtle bg-surface-muted p-3 text-sm">
            {data.issues.map((issue, i) => (
              <li key={`${issue.variantId}-${i}`} className="text-ink-muted">
                {issue.detail}
              </li>
            ))}
          </ul>
        )}

        <ul className="divide-y divide-border-subtle">
          {data.lines.map((line) => (
            <li key={line.variantId} className="flex gap-4 py-4">
              <Link
                href={`/product/${line.productSlug}`}
                className="relative size-24 shrink-0 overflow-hidden rounded border border-border-subtle bg-surface-image sm:size-28"
              >
                <Image
                  src={line.imageSrc}
                  alt={line.imageAlt}
                  fill
                  sizes="112px"
                  className="object-contain p-2"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={`/product/${line.productSlug}`} className="hover:underline">
                  <p className="line-clamp-2 text-sm font-medium">{line.title}</p>
                </Link>
                <p className="text-xs text-ink-muted">{line.optionsLabel}</p>

                {line.available ? (
                  <p className="text-xs font-medium text-in-stock">
                    In stock
                  </p>
                ) : (
                  <p className="text-xs font-medium text-sale">
                    Out of stock — not included in the total
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <span className="sr-only">Quantity for {line.title}</span>
                    <select
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                      className="rounded border border-border-strong bg-surface px-2 py-1 text-sm"
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
                    onClick={() => removeItem(line.variantId)}
                    className="text-sm font-medium text-ink-muted underline hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-semibold">{formatPrice(line.lineTotalCents)}</p>
                {line.quantity > 1 && (
                  <p className="text-xs text-ink-muted">
                    {formatPrice(line.unitPriceCents)} each
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <div className="rounded-lg border border-border-subtle bg-surface p-4 shadow-sm">
          <h2 className="text-base font-semibold">Order summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">
                Subtotal ({data.itemCount} {data.itemCount === 1 ? "item" : "items"})
              </dt>
              <dd className="font-medium">{formatPrice(data.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Delivery</dt>
              <dd className="font-medium">
                {data.shippingCents === 0 ? "Free" : formatPrice(data.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border-subtle pt-2 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-bold">{formatPrice(data.totalCents)}</dd>
            </div>
          </dl>

          {unavailable.length > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              {unavailable.length} out-of-stock{" "}
              {unavailable.length === 1 ? "item is" : "items are"} excluded from the total.
            </p>
          )}

          {data.itemCount > 0 ? (
            <Link
              href="/checkout"
              className="mt-4 block rounded-full bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-hover"
            >
              Go to checkout
            </Link>
          ) : (
            <p className="mt-4 rounded-md bg-surface-muted p-3 text-xs text-ink-muted">
              Nothing in your cart can be bought right now, so checkout is unavailable.
            </p>
          )}

          {loading && <p className="mt-2 text-xs text-ink-muted">Updating totals…</p>}
          <p className="mt-3 text-xs text-ink-muted">
            Totals are calculated on the server from the catalog.
          </p>
        </div>
      </aside>
    </div>
  );
}
