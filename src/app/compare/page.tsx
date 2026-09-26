import { CompareBoard } from "@/components/compare/compare-board";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20">
        <header className="pt-12">
          <p className="eyebrow">Decision board</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Compare up to three products
          </h1>
          <p className="mt-3 max-w-2xl text-fg-muted">
            Side by side, with what stands out, how they differ and what each one trades away —
            all computed from the live listing data.
          </p>
        </header>
        <CompareBoard />
      </main>
    </>
  );
}
