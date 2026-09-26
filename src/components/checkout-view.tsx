"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CartItem } from "@/lib/cart";
import { useCartItems, useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { useCartSummary } from "@/lib/use-cart-summary";
import { RemoteImage } from "./remote-image";
import { DemoNotice, Skeleton, StatePanel } from "./ui";

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
  /** Set for a direct checkout of one item. When present the cart is ignored. */
  directItem?: CartItem;
  storageReady: boolean;
  delivery: Delivery;
}) {
  const router = useRouter();
  const storedItems = useCartItems();
  const removeItems = useCartStore((s) => s.removeItems);

  const isDirect = directItem !== undefined;
  const ready = isDirect || storedItems !== undefined;
  const items = isDirect ? [directItem] : (storedItems ?? []);

  const { data, error, loading, reload } = useCartSummary(items, ready);
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });

  // One key for this checkout attempt, kept stable across retries, so retrying
  // after a timeout can never create a second order.
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
          setSubmission({
            state: "failed",
            message:
              "Your cart changed after this checkout was opened. Start a fresh demo order to continue — nothing has been placed.",
            retryable: false,
            recoverable: true,
          });
          return;
        }
        const message =
          payload.error === "storage_unconfigured"
            ? "Demo orders cannot be placed right now."
            : payload.error === "nothing_purchasable"
              ? "Nothing in this order can be ordered right now."
              : (payload.message ?? `The demo order failed (${response.status}).`);
        setSubmission({ state: "failed", message, retryable: response.status >= 500 });
        return;
      }

      // Only now is anything removed from the cart, and only what was ordered.
      if (!isDirect && payload.purchasedVariantIds) removeItems(payload.purchasedVariantIds);
      router.push(`/order/${payload.confirmationToken}`);
    } catch (cause) {
      setSubmission({
        state: "failed",
        message: cause instanceof Error ? cause.message : "The request did not complete.",
        retryable: true,
      });
    }
  }

  if (!ready || (!data && !error)) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]" aria-busy="true">
        <p role="status" className="sr-only">
          Pricing your demo order
        </p>
        <Skeleton className="h-72 rounded-[1.25rem]" />
        <Skeleton className="h-72 rounded-[1.25rem]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <StatePanel
        tone="error"
        title="This demo order could not be priced"
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

  const orderable = data.lines.filter((l) => l.available);

  if (orderable.length === 0) {
    return (
      <StatePanel
        title="Nothing here can be ordered"
        action={
          <Link href="/cart" className="btn btn-secondary">
            Back to demo cart
          </Link>
        }
      >
        {items.length === 0
          ? "Your demo cart is empty."
          : "Every option in this order is unpriced, out of stock or no longer in the catalog."}
      </StatePanel>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section aria-labelledby="items-heading" className="glass p-5">
          <h2 id="items-heading" className="text-base font-semibold text-fg">
            {isDirect ? "Ordering now" : "Items"} ({orderable.length})
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {orderable.map((line) => (
              <li key={line.variantId} className="flex items-center gap-4 py-3">
                <RemoteImage src={line.imageSrc || null} alt={line.imageAlt} sizes="64px" className="size-16 shrink-0" padding="p-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-fg">{line.title}</p>
                  <p className="text-xs text-fg-subtle">
                    {line.optionsLabel ? `${line.optionsLabel} · ` : ""}Qty {line.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-fg">{formatPrice(line.lineTotalCents)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="delivery-heading" className="glass p-5">
          <h2 id="delivery-heading" className="text-base font-semibold text-fg">
            Delivery
          </h2>
          <p className="mt-1 text-xs text-fg-subtle">
            Fixed demo details. Nothing about you is collected, and nothing ships.
          </p>
          <address className="mt-3 text-sm not-italic leading-relaxed text-fg-muted">
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
          <p className="mt-3 text-sm text-fg-subtle">{delivery.method}</p>
        </section>

        <section aria-labelledby="payment-heading" className="glass p-5">
          <h2 id="payment-heading" className="text-base font-semibold text-fg">
            Payment
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            None. There is no payment provider, no card form and no charge. &ldquo;Place demo
            order&rdquo; writes a demo order record and nothing else.
          </p>
        </section>
      </div>

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

          {storageReady ? (
            <button
              type="button"
              onClick={() => void placeOrder()}
              disabled={submission.state === "submitting" || loading}
              className="btn btn-primary btn-block mt-5"
            >
              {submission.state === "submitting" ? "Placing demo order…" : "Place demo order"}
            </button>
          ) : (
            <div className="mt-5 rounded-2xl border border-negative/30 bg-negative/10 p-3">
              <p className="text-sm font-semibold text-negative">Demo checkout is unavailable</p>
              <p className="mt-1 text-xs text-fg-muted">Orders cannot be placed right now. Your cart is unaffected.</p>
            </div>
          )}

          {submission.state === "failed" && (
            <div role="alert" className="mt-3 rounded-2xl border border-negative/30 bg-negative/10 p-3">
              <p className="text-sm font-medium text-negative">{submission.message}</p>
              {submission.retryable && (
                <>
                  <button type="button" onClick={() => void placeOrder()} className="btn btn-secondary btn-sm mt-2">
                    Try again
                  </button>
                  <p className="mt-2 text-xs text-fg-subtle">
                    Retrying is safe — it reuses the same order key, so it cannot create a second order.
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
                  className="btn btn-secondary btn-sm mt-2"
                >
                  Start a fresh demo order
                </button>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-fg-subtle">Totals are recalculated on the server before the order is written.</p>
          <DemoNotice className="mt-4 border-t border-line pt-4" />
        </div>
      </aside>
    </div>
  );
}
