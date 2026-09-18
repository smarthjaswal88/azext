"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CartItem } from "@/lib/cart";
import { useCartItems, useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { useCartSummary } from "@/lib/use-cart-summary";

interface Delivery {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  method: string;
}

type Submission =
  | { state: "idle" }
  | { state: "submitting" }
  | {
      state: "failed";
      message: string;
      retryable: boolean;
      /** Cannot be retried with this key, but a fresh attempt will work. */
      recoverable?: boolean;
    };

export function CheckoutView({
  directItem,
  storageReady,
  delivery,
}: {
  /** Set for Buy now. When present the cart is ignored entirely. */
  directItem?: CartItem;
  storageReady: boolean;
  delivery: Delivery;
}) {
  const router = useRouter();
  const storedItems = useCartItems();
  const removeItems = useCartStore((s) => s.removeItems);

  const isDirect = directItem !== undefined;
  // Buy now needs nothing from localStorage, so it is ready immediately.
  const ready = isDirect || storedItems !== undefined;
  const items = isDirect ? [directItem] : (storedItems ?? []);

  const { data, error, loading, reload } = useCartSummary(items, ready);
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });

  // One key for this checkout attempt, kept stable across retries. That is the
  // whole point: retrying after a timeout must not create a second order.
  const idempotencyKey = useRef<string>("");
  useEffect(() => {
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
  }, []);

  async function placeOrder() {
    if (submission.state === "submitting") return;
    setSubmission({ state: "submitting" });
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items, idempotencyKey: idempotencyKey.current }),
      });
      const payload = (await response.json()) as {
        confirmationToken?: string;
        purchasedVariantIds?: string[];
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        if (payload.error === "idempotency_key_conflict") {
          // This attempt's key was already used for different contents. Retrying
          // cannot help and must not silently surface that other order.
          setSubmission({
            state: "failed",
            message:
              "Your basket changed after this checkout was opened. Start a fresh order to continue — nothing has been placed.",
            retryable: false,
            recoverable: true,
          });
          return;
        }
        const message =
          payload.error === "storage_unconfigured"
            ? "Orders cannot be placed right now."
            : payload.error === "nothing_purchasable"
              ? "Nothing in this order can be bought right now."
              : (payload.message ?? `Order failed (${response.status}).`);
        setSubmission({
          state: "failed",
          message,
          retryable: response.status >= 500 || response.status === 503,
        });
        return;
      }

      // Only now is anything removed from the cart, and only what was bought.
      if (!isDirect && payload.purchasedVariantIds) {
        removeItems(payload.purchasedVariantIds);
      }
      router.push(`/order/${payload.confirmationToken}`);
    } catch (cause) {
      setSubmission({
        state: "failed",
        message: cause instanceof Error ? cause.message : "The request did not complete.",
        retryable: true,
      });
    }
  }

  if (!ready) return <p className="py-16 text-center text-muted-ink">Loading…</p>;

  if (error) {
    return (
      <div className="rounded-lg border border-border-subtle p-8 text-center">
        <p className="font-medium text-sale">We could not price this order.</p>
        <p className="mt-1 text-sm text-muted-ink">{error}</p>
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

  if (!data) return <p className="py-16 text-center text-muted-ink">Pricing…</p>;

  const purchasable = data.lines.filter((l) => l.available);

  if (purchasable.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle p-12 text-center">
        <h2 className="text-lg font-medium">Nothing here can be bought</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-ink">
          {items.length === 0
            ? "Your cart is empty."
            : "Everything in this order is out of stock or no longer in the catalog."}
        </p>
        <Link
          href="/cart"
          className="mt-5 inline-block rounded-md border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-surface-muted"
        >
          Back to cart
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="rounded-lg border border-border-subtle bg-surface p-4">
          <h2 className="text-base font-semibold">Delivery</h2>
          <p className="mt-1 text-xs text-muted-ink">
            Fixed demo details. No form collects anything about you, and nothing ships.
          </p>
          <address className="mt-3 text-sm not-italic leading-relaxed">
            {delivery.name}
            <br />
            {delivery.line1}
            <br />
            {delivery.line2}
            <br />
            {delivery.city}, {delivery.region} {delivery.postalCode}
            <br />
            {delivery.country}
          </address>
          <p className="mt-3 text-sm text-muted-ink">{delivery.method}</p>
        </section>

        <section className="rounded-lg border border-border-subtle bg-surface p-4">
          <h2 className="text-base font-semibold">Payment</h2>
          <p className="mt-1 text-sm text-muted-ink">
            None. This is a simulated checkout — there is no payment provider, no card form and
            no charge. &ldquo;Place demo order&rdquo; writes an order record and nothing else.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">
            {isDirect ? "Buying now" : "Items"} ({purchasable.length})
          </h2>
          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {purchasable.map((line) => (
              <li key={line.variantId} className="flex items-center gap-4 py-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded border border-border-subtle bg-surface-muted">
                  <Image
                    src={line.imageSrc}
                    alt={line.imageAlt}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{line.title}</p>
                  <p className="text-xs text-muted-ink">
                    {line.optionsLabel} · Qty {line.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold">
                  {formatPrice(line.lineTotalCents)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <div className="rounded-lg border border-border-subtle bg-surface p-4">
          <h2 className="text-base font-semibold">Order summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-ink">
                Subtotal ({data.itemCount} {data.itemCount === 1 ? "item" : "items"})
              </dt>
              <dd className="font-medium">{formatPrice(data.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-ink">Delivery</dt>
              <dd className="font-medium">
                {data.shippingCents === 0 ? "Free" : formatPrice(data.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border-subtle pt-2 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-bold">{formatPrice(data.totalCents)}</dd>
            </div>
          </dl>

          {storageReady ? (
            <button
              type="button"
              onClick={() => void placeOrder()}
              disabled={submission.state === "submitting" || loading}
              className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60"
            >
              {submission.state === "submitting" ? "Placing order…" : "Place demo order"}
            </button>
          ) : (
            <div className="mt-4 rounded-md border border-sale/40 bg-surface-muted p-3">
              <p className="text-sm font-semibold text-sale">Checkout is unavailable</p>
              <p className="mt-1 text-xs text-muted-ink">
                Orders cannot be placed right now. Your cart is unaffected.
              </p>
            </div>
          )}

          {submission.state === "failed" && (
            <div className="mt-3 rounded-md border border-sale/40 p-3">
              <p className="text-sm font-medium text-sale">{submission.message}</p>
              {submission.retryable && (
                <>
                  <button
                    type="button"
                    onClick={() => void placeOrder()}
                    className="mt-2 rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
                  >
                    Try again
                  </button>
                  <p className="mt-2 text-xs text-muted-ink">
                    Retrying is safe — it reuses the same order key, so it cannot create a second
                    order.
                  </p>
                </>
              )}
              {submission.recoverable && (
                <button
                  type="button"
                  onClick={() => {
                    idempotencyKey.current = crypto.randomUUID();
                    setSubmission({ state: "idle" });
                  }}
                  className="mt-2 rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
                >
                  Start a fresh order
                </button>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-ink">
            Totals are recalculated on the server before the order is written.
          </p>
        </div>
      </aside>
    </div>
  );
}
