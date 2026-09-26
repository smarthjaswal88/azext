"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  EMPTY_FILTERS,
  apiQuery,
  applyLocalFilters,
  parseFilters,
  priceRange,
  serializeFilters,
  type DiscoveryFilters,
} from "@/lib/discovery-filters";
import { useCatalogCategories, useCatalogProducts } from "@/lib/use-catalog";
import { SectionHeading } from "../ui";
import { filterOptionsFor } from "./catalog-options";
import { CategoryExplorer } from "./category-explorer";
import { DiscoveryControls } from "./discovery-controls";
import { DiscoveryResults } from "./discovery-results";
import { LiveStats } from "./live-stats";

function scrollToResults() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("results")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/**
 * Stats, category explorer, filters and results, all from the live catalog
 * API. The URL is the single source of filter state.
 */
export function DiscoveryExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const categories = useCatalogCategories();
  const categoryList = categories.state.status === "ready" ? categories.state.data.categories : undefined;
  const options = useMemo(
    () => (categoryList ? filterOptionsFor(categoryList, filters.category) : undefined),
    [categoryList, filters.category],
  );

  const query = useMemo(() => apiQuery(filters), [filters]);
  const products = useCatalogProducts(query);

  const visible = useMemo(
    () =>
      products.state.status === "ready" ? applyLocalFilters(products.state.data.products, filters) : undefined,
    [products.state, filters],
  );

  const write = useCallback(
    (next: DiscoveryFilters) => {
      const qs = serializeFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  /** Merges into the filters in the URL right now, so a delayed update (the
   *  search debounce) never undoes a change made in the meantime. */
  const update = useCallback(
    (patch: Partial<DiscoveryFilters>) => {
      const next = { ...parseFilters(new URLSearchParams(window.location.search)), ...patch };
      if (patch.category !== undefined && categoryList) {
        const scoped = filterOptionsFor(categoryList, next.category);
        if (next.type && !scoped.types.some((t) => t.id === next.type)) next.type = "";
        if (next.brand && !scoped.brands.includes(next.brand)) next.brand = "";
      }
      write(next);
    },
    [categoryList, write],
  );

  const reset = useCallback(() => write(EMPTY_FILTERS), [write]);

  const resultCount = visible?.length;
  const heading =
    resultCount === undefined
      ? "Loading products"
      : `${resultCount} ${resultCount === 1 ? "product" : "products"}`;

  return (
    <>
      <LiveStats state={categories.state} />

      <CategoryExplorer
        state={categories.state}
        active={filters.category}
        onRetry={categories.retry}
        onSelect={(category) => {
          update({ category });
          scrollToResults();
        }}
      />

      <section aria-labelledby="results-heading" className="mt-16 scroll-mt-24" id="results">
        <SectionHeading
          id="results-heading"
          eyebrow="Discover"
          title={heading}
          description={
            filters.q
              ? `Matching “${filters.q}”. Search covers titles, brands and descriptions.`
              : "Search and filter the live catalog. Add up to three products to compare."
          }
        />
        <DiscoveryControls
          filters={filters}
          categories={categoryList}
          options={options}
          priceProblem={priceRange(filters).problem}
          onChange={update}
          onReset={reset}
        />
        <div className="mt-6">
          <DiscoveryResults state={products.state} visible={visible} onRetry={products.retry} onReset={reset} />
        </div>
      </section>
    </>
  );
}
