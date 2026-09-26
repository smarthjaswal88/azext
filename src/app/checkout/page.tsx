import Link from "next/link";
import { CheckoutView } from "@/components/checkout-view";
import { SiteHeader } from "@/components/site-header";
import { clampQuantity, type CartItem } from "@/lib/cart";
import { DEMO_DELIVERY } from "@/server/orders";
import { isSupabaseConfigured, warnIfUnconfigured } from "@/server/supabase";

export const metadata = { title: "Demo checkout" };

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;

  // A direct checkout arrives as ?variant=…&qty=…, and checks out that one
  // option alone. The id is not trusted here — it is priced on the server by
  // /api/cart/summary and again by /api/orders.
  const variantId = one(params, "variant");
  const directItem: CartItem | undefined = variantId
    ? { variantId, quantity: clampQuantity(Number(one(params, "qty") ?? 1)).quantity }
    : undefined;

  const storageReady = isSupabaseConfigured();
  // Names any missing variables in the server log, never on the page.
  warnIfUnconfigured();

  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20">
        <header className="pb-8 pt-12">
          <p className="eyebrow">Demo order flow</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Demo checkout</h1>
          <p className="mt-3 max-w-2xl text-fg-muted">
            No payment is taken and nothing ships. Delivery details are fixed demo values, so you
            can finish the flow without entering anything about yourself.{" "}
            {!directItem && (
              <Link href="/cart" className="link">
                Back to demo cart
              </Link>
            )}
          </p>
        </header>

        {!storageReady && (
          <div role="status" className="mb-6 rounded-2xl border border-negative/30 bg-negative/10 p-4">
            <p className="text-sm font-semibold text-negative">Demo checkout is unavailable</p>
            <p className="mt-1 text-sm text-fg-muted">
              Demo orders cannot be placed right now. Browsing and the cart still work, and anything
              you added stays where it is.
            </p>
          </div>
        )}

        <CheckoutView directItem={directItem} storageReady={storageReady} delivery={DEMO_DELIVERY} />
      </main>
    </>
  );
}
