import { Suspense } from "react";
import { AssistantCallout, DiscoveryExperience } from "@/components/discovery/discovery-experience";
import { ResultsSkeleton } from "@/components/discovery/discovery-results";
import { SiteHeader } from "@/components/site-header";

/**
 * The workspace's frame, built from the same pieces and classes as the real
 * one — sidebar, sticky search bar, heading row with the sort control, the
 * Decision Assistant line, the category chip row and the card grid — so
 * nothing moves when it arrives.
 */
function DiscoveryFallback() {
  return (
    <div aria-hidden="true" className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <span className="skeleton hidden h-147 rounded-[1.25rem] lg:block" />
      <div className="min-w-0">
        <div className="sticky top-14 z-30 -mx-4 mb-3 border-b border-line bg-graphite-950/85 px-4 py-2.5 sm:-mx-6 sm:px-6 lg:hidden">
          <div className="flex gap-2">
            <span className="skeleton block h-11 flex-1 rounded-[0.85rem]" />
            <span className="skeleton block h-11 w-26 rounded-[0.85rem]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <span className="skeleton block h-7 w-44 sm:h-8 sm:w-72" />
            <span className="skeleton mt-2 hidden h-4 w-56 sm:block" />
          </div>
          <span className="skeleton block h-11 w-36 rounded-[0.85rem] sm:w-48" />
        </div>
        <AssistantCallout className="mt-3" />
        <div className="-mx-1 mt-2 flex h-13 items-center gap-2 px-1 lg:hidden">
          {["w-16", "w-24", "w-28"].map((width) => (
            <span key={width} className={`skeleton block h-9 shrink-0 rounded-full max-sm:h-11 ${width}`} />
          ))}
        </div>
        <div className="mt-4 sm:mt-5">
          <ResultsSkeleton />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20">
        <section aria-labelledby="discover-heading" className="pb-3 pt-3.5 sm:pb-6 sm:pt-8">
          <h1
            id="discover-heading"
            className="text-[1.45rem] font-semibold leading-tight tracking-tight text-fg sm:text-[2rem]"
          >
            Compare real product data. <span className="text-gradient">Decide with confidence.</span>
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted sm:mt-2 sm:text-[0.95rem]">
            <span className="sm:hidden">Collected once; details may have changed.</span>
            <span className="hidden sm:inline">
              Real prices, ratings and specifications from retailer listings, collected once and may have
              changed since. Shortlist up to three products and weigh them side by side.
            </span>
          </p>
        </section>

        <Suspense fallback={<DiscoveryFallback />}>
          <DiscoveryExperience />
        </Suspense>
      </main>
    </>
  );
}
