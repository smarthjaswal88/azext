"use client";

import Link from "next/link";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart";
import { useCartItems, useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { useCartSummary } from "@/lib/use-cart-summary";
import { ArrowRightIcon } from "./icons";
import { RemoteImage } from "./remote-image";
import { DemoNotice, Skeleton, StatePanel } from "./ui";

/** The demo cart. Browser storage holds variant ids and quantities only;
 *  every price, total and availability shown here comes from the server. */
export function CartView() {
  const stored = useCartItems();
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const items = stored ?? [];
  const { data, error, loading, reload } = useCartSummary(items, stored !== undefined);

  if (stored === undefined || (items.length > 0 && !data && !error)) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]" aria-busy="true">
        <p role="status" className="sr-only">
          {stored === undefined ? "Loading your demo cart" : "Pricing your demo cart"}
        </p>
        <Skeleton className="h-64 rounded-[1.25rem]" />
        <Skeleton className="h-64 rounded-[1.25rem]" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <StatePanel
        title="Your demo cart is empty"
        action={
          <Link href="/" className="btn btn-primary">
            Discover products
            <ArrowRightIcon size={16} />
          </Link>
        }
      >
        Add an option from any product page to try the demo order flow.
      </StatePanel>
    );
  }

  if (error || !data) {
    return (
      <StatePanel
        tone="error"
        title="The demo cart could not be priced"
        action={
          <button type="button" onClick={reload} className="btn btn-secondary">
            Try again
          </button>
        }
      >
        {error}
      </StatePanel>
    );
  }

  const unavailable = data.lines.filter((l) => !l.available);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section aria-labelledby="cart-lines-heading" className="glass p-4 sm:p-5">
        <h2 id="cart-lines-heading" className="sr-only">
          Items in your demo cart
        </h2>

        {data.issues.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-2xl border border-caution/30 bg-caution/10 p-3 text-sm text-caution">
            {data.issues.map((issue, i) => (
              <li key={`${issue.variantId}-${i}`}>{issue.detail}</li>
            ))}
          </ul>
        )}

        <ul className="divide-y divide-line">
          {data.lines.map((line) => (
            <li key={line.variantId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <Link href={`/product/${line.productSlug}`} className="shrink-0">
                <RemoteImage src={line.imageSrc || null} alt={line.imageAlt} sizes="96px" className="size-24" padding="p-2" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {line.brand && <p className="eyebrow">{line.brand}</p>}
                <Link href={`/product/${line.productSlug}`} className="line-clamp-2 text-sm font-medium text-fg hover:underline">
                  {line.title}
                </Link>
                {line.optionsLabel && <p className="text-xs text-fg-subtle">{line.optionsLabel}</p>}
                {!line.available && (
                  <p className="text-xs font-medium text-caution">Not orderable — excluded from the total</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs text-fg-subtle">
                    Qty
                    <select
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                      className="field min-h-9 w-20 py-1"
                    >
                      {Array.from({ length: MAX_QUANTITY_PER_LINE }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <span className="sr-only">for {line.title}</span>
                  </label>
                  <button type="button" onClick={() => removeItem(line.variantId)} className="btn btn-ghost btn-sm">
                    Remove
                  </button>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-fg">{formatPrice(line.lineTotalCents)}</p>
                {line.quantity > 1 && line.available && (
                  <p className="text-xs tabular-nums text-fg-subtle">{formatPrice(line.unitPriceCents)} each</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="glass-strong p-5">
          <h2 className="text-base font-semibold text-fg">Demo order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">
                Subtotal ({data.itemCount} {data.itemCount === 1 ? "item" : "items"})
              </dt>
              <dd className="tabular-nums text-fg">{formatPrice(data.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-muted">Delivery</dt>
              <dd className="text-fg">{data.shippingCents === 0 ? "None — demo" : formatPrice(data.shippingCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base">
              <dt className="font-semibold text-fg">Total</dt>
              <dd className="font-semibold tabular-nums text-fg">{formatPrice(data.totalCents)}</dd>
            </div>
          </dl>
          {unavailable.length > 0 && (
            <p className="mt-3 text-xs text-fg-subtle">
              {unavailable.length} {unavailable.length === 1 ? "line is" : "lines are"} excluded from the total.
            </p>
          )}
          {data.itemCount > 0 ? (
            <Link href="/checkout" className="btn btn-primary btn-block mt-5">
              Continue to demo checkout
              <ArrowRightIcon size={16} />
            </Link>
          ) : (
            <p className="mt-5 text-xs text-fg-muted">Nothing in this cart can be ordered, so checkout is unavailable.</p>
          )}
          {loading && (
            <p role="status" className="mt-2 text-xs text-fg-subtle">
              Updating totals…
            </p>
          )}
          <p className="mt-4 text-xs text-fg-subtle">Totals are recalculated on the server from the live catalog.</p>
          <DemoNotice className="mt-4 border-t border-line pt-4" />
        </div>
      </aside>
    </div>
  );
}
