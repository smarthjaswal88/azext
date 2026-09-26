import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { formatPrice } from "@/lib/format";
import { getOrderByToken } from "@/server/orders";

export const metadata = { title: "Demo order confirmation" };

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
        <main id="main" className="container-app flex-1 pb-20 pt-12">
          <div className="glass mx-auto max-w-2xl p-8">
            <h1 className="text-2xl font-semibold text-fg">Order details unavailable</h1>
            <p className="mt-2 text-fg-muted">
              This demo order cannot be looked up right now. Nothing is lost — try the link again shortly.
            </p>
            <Link href="/" className="btn btn-secondary mt-6">
              Back to discovery
            </Link>
          </div>
        </main>
      </>
    );
  }

  const { order } = result;

  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20 pt-12">
        <div className="mx-auto max-w-3xl">
          <div className="glass-strong glow p-6 sm:p-8">
            <span className="badge badge-caution">Demo order — nothing was charged or shipped</span>
            <div className="mt-5 flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-violet text-accent-ink">
                <CheckIcon size={22} />
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-fg">Order placed</h1>
                <p className="mt-1 text-sm text-fg-muted">
                  Placed{" "}
                  {new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-line bg-tint/3 p-4">
              <p className="text-xs text-fg-subtle">Confirmation reference</p>
              <p className="mt-1 break-all font-mono text-sm text-fg">{order.confirmationToken}</p>
              <p className="mt-2 text-xs text-fg-subtle">
                Keep this link to return to the order. It is the only way to reach it — orders are not
                listed anywhere and cannot be browsed.
              </p>
            </div>
          </div>

          <section aria-labelledby="order-items-heading" className="glass mt-6 p-6">
            <h2 id="order-items-heading" className="text-base font-semibold text-fg">
              Items
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${item.productSlug}`} className="text-sm font-medium text-fg hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-fg-subtle">
                      {item.optionsLabel ? `${item.optionsLabel} · ` : ""}Qty {item.quantity} ·{" "}
                      {formatPrice(item.unitPriceCents)} each
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-fg">
                    {formatPrice(item.lineTotalCents)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Subtotal</dt>
                <dd className="tabular-nums text-fg">{formatPrice(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Delivery</dt>
                <dd className="text-fg">{order.shippingCents === 0 ? "None — demo" : formatPrice(order.shippingCents)}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="font-semibold text-fg">Total</dt>
                <dd className="font-semibold tabular-nums text-fg">{formatPrice(order.totalCents)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="order-delivery-heading" className="glass mt-6 p-6">
            <h2 id="order-delivery-heading" className="text-base font-semibold text-fg">
              Delivery (demo)
            </h2>
            <address className="mt-2 text-sm not-italic leading-relaxed text-fg-muted">
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
          </section>

          <Link href="/" className="btn btn-primary mt-8">
            Continue discovering
          </Link>
        </div>
      </main>
    </>
  );
}
