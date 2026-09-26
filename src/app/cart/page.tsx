import { CartView } from "@/components/cart-view";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Demo cart" };

export default function CartPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20">
        <header className="pb-8 pt-12">
          <p className="eyebrow">Demo order flow</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Demo cart</h1>
          <p className="mt-3 max-w-2xl text-fg-muted">
            A practice run of ordering. No payment is taken and nothing ships; every total is
            recalculated on the server from the live catalog.
          </p>
        </header>
        <CartView />
      </main>
    </>
  );
}
