import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { formatPrice } from "@/lib/format";
import { getOrderByToken } from "@/server/orders";

export const metadata = { title: "Order confirmation" };

/** Rendered from the database on every request, so a refresh, a bookmark or a
 *  shared link keeps working — nothing here depends on client state. */
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getOrderByToken(token);

  if (result.status === "not_found") notFound();

  if (result.status === "unconfigured" || result.status === "error") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-10 sm:px-4">
          <h1 className="text-2xl font-semibold">Order details unavailable</h1>
          <p className="mt-2 text-ink-muted">
            We cannot look up this order right now. Nothing is lost — try the link again
            shortly.
          </p>
          <Link
            href="/search"
            className="mt-6 inline-block rounded-md border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Back to the catalog
          </Link>
        </main>
      </>
    );
  }

  const { order } = result;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-6 sm:px-4">
        <p className="inline-block rounded border border-border-subtle bg-surface-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Demo order — nothing was charged or shipped
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Order placed</h1>
        <p className="mt-1 text-ink-muted">
          Placed{" "}
          {new Date(order.createdAt).toLocaleString("en-US", {
            dateStyle: "long",
            timeStyle: "short",
          })}
          .
        </p>

        <div className="mt-5 rounded-lg border border-border-subtle bg-surface p-4">
          <p className="text-sm text-ink-muted">Confirmation reference</p>
          <p className="mt-1 break-all font-mono text-sm">{order.confirmationToken}</p>
          <p className="mt-2 text-xs text-ink-muted">
            Keep this link to return to the order. It is the only way to reach it — orders are not
            listed anywhere and cannot be browsed.
          </p>
        </div>

        <h2 className="mt-8 text-base font-semibold">Items</h2>
        <ul className="mt-2 divide-y divide-border-subtle border-y border-border-subtle">
          {order.items.map((item) => (
            <li key={item.variantId} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/product/${item.productSlug}`} className="hover:underline">
                  <p className="text-sm font-medium">{item.title}</p>
                </Link>
                <p className="text-xs text-ink-muted">
                  {item.optionsLabel} · Qty {item.quantity} ·{" "}
                  {formatPrice(item.unitPriceCents)} each
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">
                {formatPrice(item.lineTotalCents)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd>{formatPrice(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Delivery</dt>
            <dd>{order.shippingCents === 0 ? "Free" : formatPrice(order.shippingCents)}</dd>
          </div>
          <div className="flex justify-between border-t border-border-subtle pt-2 text-base">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold">{formatPrice(order.totalCents)}</dd>
          </div>
        </dl>

        <h2 className="mt-8 text-base font-semibold">Delivery</h2>
        <address className="mt-2 text-sm not-italic leading-relaxed text-ink-muted">
          {order.delivery.name}
          <br />
          {order.delivery.line1}
          <br />
          {order.delivery.line2}
          <br />
          {order.delivery.city}, {order.delivery.region} {order.delivery.postalCode}
          <br />
          {order.delivery.country}
        </address>

        <Link
          href="/search"
          className="mt-8 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
        >
          Continue shopping
        </Link>
      </main>
    </>
  );
}
