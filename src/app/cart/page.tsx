import { CartView } from "@/components/cart-view";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <h1 className="mb-5 text-2xl font-semibold">Your cart</h1>
        <CartView />
      </main>
    </>
  );
}
