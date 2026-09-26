import Link from "next/link";
import { Suspense } from "react";
import { DiscoveryExperience } from "@/components/discovery/discovery-experience";
import { ArrowRightIcon, CompareIcon, SearchIcon, SparkIcon } from "@/components/icons";
import { ProductCardSkeleton } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";

const STEPS = [
  { icon: SearchIcon, title: "Discover", text: "Search and filter real listings by category, type, brand, price and rating." },
  { icon: CompareIcon, title: "Compare", text: "Put up to three products side by side, with differences surfaced first." },
  { icon: SparkIcon, title: "Decide", text: "Read the tradeoffs, check the source listing, and choose with the evidence in view." },
];

function DiscoveryFallback() {
  return (
    <div aria-hidden="true">
      <span className="skeleton block h-20 rounded-[1.25rem]" />
      <span className="skeleton mt-16 block h-44 rounded-[1.25rem]" />
      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20">
        <section aria-labelledby="hero-heading" className="grid gap-10 pb-10 pt-14 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgb(111_141_255/0.8)]" />
              Live catalog · real listing data
            </p>
            <h1 id="hero-heading" className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-6xl">
              Discover, compare and <span className="text-gradient">decide with real data.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
              Nexus turns product listings into a decision workspace. Every price, rating and
              specification on this site comes from the live catalog — nothing is invented.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#results" className="btn btn-primary">
                Explore products
                <ArrowRightIcon size={16} />
              </a>
              <Link href="/compare" className="btn btn-secondary">
                Open comparison
              </Link>
            </div>
          </div>
          <ol className="grid gap-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="glass flex items-start gap-4 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-accent/40 bg-accent/10 text-accent-strong">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-fg">
                    <span className="mr-2 text-fg-subtle tabular-nums">0{i + 1}</span>
                    {title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-fg-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <Suspense fallback={<DiscoveryFallback />}>
          <DiscoveryExperience />
        </Suspense>
      </main>
    </>
  );
}
