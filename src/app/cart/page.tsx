import { CartView } from "@/components/cart-view";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-4 sm:px-4">
        <h1 className="mb-3 text-xl font-bold sm:text-2xl">Your cart</h1>
        <CartView />
      </main>
    </>
  );
}
