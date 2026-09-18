import Link from "next/link";
import { CheckoutView } from "@/components/checkout-view";
import { SiteHeader } from "@/components/site-header";
import { clampQuantity, type CartItem } from "@/lib/cart";
import { DEMO_DELIVERY } from "@/server/orders";
import { isSupabaseConfigured, warnIfUnconfigured } from "@/server/supabase";

export const metadata = { title: "Checkout" };

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

  // Buy now arrives as ?variant=…&qty=…, which checks out that selection alone.
  // The variant id is not trusted here — it is resolved and priced server-side
  // by /api/cart/summary and again by /api/orders.
  const variantId = one(params, "variant");
  const directItem: CartItem | undefined = variantId
    ? { variantId, quantity: clampQuantity(Number(one(params, "qty") ?? 1)).quantity }
    : undefined;

  const storageReady = isSupabaseConfigured();
  // Names the missing variables in the server log, not on the page.
  warnIfUnconfigured();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div className="mb-5">
          <p className="inline-block rounded bg-surface-muted px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-ink">
            Simulated checkout
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Checkout</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-ink">
            No payment is taken and nothing ships. Delivery details are fixed demo values, so you
            can complete the journey without entering anything about yourself.{" "}
            {!directItem && (
              <Link href="/cart" className="underline hover:no-underline">
                Back to cart
              </Link>
            )}
          </p>
        </div>

        {!storageReady && (
          <div className="mb-6 rounded-lg border border-sale/40 bg-surface-muted p-4">
            <h2 className="text-base font-semibold text-sale">Checkout is unavailable</h2>
            <p className="mt-1 max-w-prose text-sm text-muted-ink">
              Orders cannot be placed right now. Browsing and the cart still work, and anything
              you have added stays where it is.
            </p>
          </div>
        )}

        <CheckoutView
          directItem={directItem}
          storageReady={storageReady}
          delivery={DEMO_DELIVERY}
        />
      </main>
    </>
  );
}
