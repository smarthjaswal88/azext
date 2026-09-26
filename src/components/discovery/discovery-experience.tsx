"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProductCollection } from "@/lib/catalog-client";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  apiQuery,
  applyLocalFilters,
  parseFilters,
  priceRange,
  serializeFilters,
  type DiscoveryFilters,
} from "@/lib/discovery-filters";
import { formatPrice } from "@/lib/format";
import { useCatalogCategories, useCatalogProducts } from "@/lib/use-catalog";
import { SlidersIcon, SparkIcon } from "../icons";
import { ActiveFilters, activeFiltersOf, appliedFilterCount } from "./active-filters";
import { filterOptionsFor } from "./catalog-options";
import { CategoryExplorer } from "./category-explorer";
import { FilterPanel, SearchField, SortSelect, type PriceFilterHandle } from "./discovery-controls";
import { DiscoveryResults } from "./discovery-results";
import { FilterSheet } from "./filter-sheet";

/** Where keyboard focus goes once a change that removed its control lands. */
type FocusTarget = { kind: "chip"; index: number } | { kind: "results" };

/** Brings the top of the results into view — only when it has scrolled
 *  above the viewport, if `onlyIfAbove`, so a filter change never jumps.
 *  The root's scroll-padding keeps it clear of the sticky bars. */
function scrollToResults(onlyIfAbove = false) {
  const results = document.getElementById("results");
  if (!results) return;
  if (onlyIfAbove && results.getBoundingClientRect().top >= 0) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  results.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

/** Placeholder chips while the categories load, at the real chips' size. */
const CHIP_PLACEHOLDERS = ["w-16", "w-24", "w-28"];

/** Where the Decision Assistant is introduced. It works from listing
 *  details, ratings and rating counts; review text was never imported. */
export function AssistantCallout({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex w-full items-start gap-2.5 text-[0.8rem] leading-snug sm:w-fit sm:max-w-full sm:gap-3 sm:rounded-2xl sm:border sm:border-accent/25 sm:bg-linear-to-r sm:from-accent/10 sm:via-violet/8 sm:to-transparent sm:px-3.5 sm:py-2 ${className}`}
    >
      <span
        aria-hidden="true"
        className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-accent to-violet text-accent-ink sm:size-6 sm:rounded-lg"
      >
        <SparkIcon size={12} />
      </span>
      <span className="sm:self-center">
        <span className="font-medium text-fg-muted sm:text-fg">
          Compare up to 3 products, then ask the Decision Assistant what fits your needs.
        </span>
      </span>
    </p>
  );
}

/**
 * The discovery workspace: a sticky filter sidebar beside the results on
 * desktop; a search bar, a Filters sheet and quick category chips on
 * smaller screens. Everything comes from the live catalog API.
 *
 * The URL is the single source of filter state, written with the History
 * API (which Next keeps in sync with useSearchParams). Each filter change
 * adds a history entry, so Back and Forward step through them; typing a
 * search refines one entry rather than adding one per pause. Every change is
 * merged into the URL as it is at that moment, which the History API
 * updates synchronously, so quick successive changes never undo each other.
 */
export function DiscoveryExperience() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Remount keys: a reset clears drafts and cancels a pending search.
  const [searchKey, setSearchKey] = useState(0);
  const [panelKey, setPanelKey] = useState(0);
  const [sheetPanelKey, setSheetPanelKey] = useState(0);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const sheetPrice = useRef<PriceFilterHandle>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const lastWrite = useRef<"search" | "filter" | null>(null);

  const categories = useCatalogCategories();
  const categoryList = categories.state.status === "ready" ? categories.state.data.categories : undefined;
  const options = useMemo(
    () => (categoryList ? filterOptionsFor(categoryList, filters.category) : undefined),
    [categoryList, filters.category],
  );
  const overview = useMemo(() => (categoryList ? filterOptionsFor(categoryList, "") : undefined), [categoryList]);

  const query = useMemo(() => apiQuery(filters), [filters]);
  const products = useCatalogProducts(query);

  // The last loaded collection stays on screen while the next one loads.
  const [shown, setShown] = useState<ProductCollection>();
  if (products.state.status === "ready" && shown !== products.state.data) setShown(products.state.data);

  const visible = useMemo(() => (shown ? applyLocalFilters(shown.products, filters) : undefined), [shown, filters]);

  /** Products per type in the results, before the type filter itself. */
  const typeCounts = useMemo(() => {
    if (!shown) return undefined;
    const counts = new Map<string, number>();
    for (const p of applyLocalFilters(shown.products, { ...filters, type: "" })) {
      counts.set(p.productType, (counts.get(p.productType) ?? 0) + 1);
    }
    return counts;
  }, [shown, filters]);

  const write = useCallback(
    (next: DiscoveryFilters, kind: "search" | "filter" = "filter") => {
      const qs = serializeFilters(next);
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      if (kind === "search" && lastWrite.current === "search") window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
      lastWrite.current = kind;
    },
    [pathname],
  );

  // After Back or Forward, the next search starts a new history entry.
  useEffect(() => {
    const onPop = () => {
      lastWrite.current = null;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback(
    (patch: Partial<DiscoveryFilters>, kind: "search" | "filter" = "filter") => {
      const next = { ...parseFilters(new URLSearchParams(window.location.search)), ...patch };
      if (patch.category !== undefined && categoryList) {
        const scoped = filterOptionsFor(categoryList, next.category);
        if (next.type && !scoped.types.some((t) => t.id === next.type)) next.type = "";
        if (next.brand && !scoped.brands.includes(next.brand)) next.brand = "";
      }
      write(next, kind);
    },
    [categoryList, write],
  );

  /** A change made beside or above the results: if the shopper had scrolled
   *  into them, bring the new first results back into view. */
  const updateInPlace = useCallback(
    (patch: Partial<DiscoveryFilters>, kind: "search" | "filter" = "filter") => {
      update(patch, kind);
      requestAnimationFrame(() => scrollToResults(true));
    },
    [update],
  );

  // Move focus once the change that removed the focused control has landed.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target.kind === "chip") {
      const chips = [...document.querySelectorAll<HTMLButtonElement>("[data-active-filter]")];
      const next = chips[Math.min(target.index, chips.length - 1)];
      if (next) {
        next.focus();
        return;
      }
    }
    document.getElementById("results-heading")?.focus({ preventScroll: true });
  }, [filters]);

  /** Clears every filter and the search; the sort order is kept. */
  const clearAll = useCallback(
    (focus?: FocusTarget) => {
      if (focus) pendingFocus.current = focus;
      write({ ...EMPTY_FILTERS, sort: filters.sort });
      setSearchKey((k) => k + 1);
      setPanelKey((k) => k + 1);
      setSheetPanelKey((k) => k + 1);
      requestAnimationFrame(() => scrollToResults(true));
    },
    [filters.sort, write],
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    // An unapplied price typed in the sheet is discarded, not kept hidden.
    setSheetPanelKey((k) => k + 1);
    requestAnimationFrame(() => {
      // The dialog hands focus back to what opened it; this covers a
      // browser that does not.
      if (document.activeElement === document.body) filtersButton.current?.focus();
      scrollToResults(true);
    });
  }, []);

  /** The sheet's primary action applies a typed price, then closes. An
   *  invalid price keeps the sheet open with the error in view. */
  const showResults = useCallback(() => {
    if (sheetPrice.current?.commit() === "invalid") return;
    closeSheet();
  }, [closeSheet]);

  const priceProblem = priceRange(filters).problem;
  const filtered = appliedFilterCount(filters) > 0;
  const hasChips = activeFiltersOf(filters).length > 0;
  const canReset = activeFilterCount(filters) > 0;
  const canResetSheet = [filters.category, filters.type, filters.brand, filters.min, filters.max, filters.rating].some(
    Boolean,
  );
  /** The filters inside the sheet that narrow the results; search sits
   *  outside it, and an ignored price range does not count. */
  const sheetCount = [
    filters.category,
    filters.type,
    filters.brand,
    (filters.min || filters.max) && !priceProblem,
    filters.rating,
  ].filter(Boolean).length;
  // Catalog-wide category counts are only true when nothing else narrows.
  const showCategoryCounts = !(filters.q || filters.type || filters.brand || filters.min || filters.max || filters.rating);

  const status = products.state.status;
  const count = shown && visible ? (filtered ? visible.length : shown.total) : undefined;
  const totalProducts = categories.state.status === "ready" ? categories.state.data.totalProducts : undefined;

  let title: ReactNode;
  if (status === "error") title = "Products unavailable";
  else if (count === undefined) title = "Loading live products";
  else if (filtered) title = plural(count, "matching product");
  else
    title = (
      <>
        <span className="hidden sm:inline">Explore </span>
        {count} live {count === 1 ? "product" : "products"}
      </>
    );

  let subtitle: ReactNode = null;
  if (filtered) {
    subtitle = (
      <p className="mt-1 text-sm text-fg-muted">
        {[
          totalProducts !== undefined ? `Out of ${totalProducts} products in the live catalog.` : "",
          filters.q ? "Search covers titles, brands and descriptions." : "",
        ]
          .filter(Boolean)
          .join(" ")}
      </p>
    );
  } else if (categoryList && overview) {
    subtitle = (
      <p className="mt-1 hidden text-sm text-fg-muted sm:block">
        {[
          plural(categoryList.length, "category", "categories"),
          plural(overview.brands.length, "brand"),
          overview.priceRangeCents
            ? `${formatPrice(overview.priceRangeCents.min)} – ${formatPrice(overview.priceRangeCents.max)}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    );
  } else if (categories.state.status === "loading") {
    subtitle = <span aria-hidden="true" className="skeleton mt-2 hidden h-4 w-56 sm:block" />;
  }

  const announcement =
    status === "error"
      ? "Products could not be loaded."
      : count === undefined
        ? ""
        : status === "loading"
          ? "Updating results…"
          : `${plural(count, "product")} shown`;

  const panelProps = {
    filters,
    categories: categoryList,
    options,
    typeCounts,
    showCategoryCounts,
    priceProblem,
  };

  return (
    <>
      <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside
          aria-label="Product filters"
          className="scroll-slim hidden lg:sticky lg:top-18 lg:block lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pb-1"
        >
          <div className="glass-strong p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <SlidersIcon size={15} className="text-fg-muted" />
                Filters
              </h2>
              {/* Not `disabled`, so it keeps focus after resetting. */}
              <button
                type="button"
                onClick={() => {
                  if (canReset) clearAll();
                }}
                aria-disabled={!canReset}
                className="btn btn-ghost btn-sm -mr-1.5 min-h-8 px-2.5 aria-disabled:cursor-default aria-disabled:opacity-50"
              >
                Reset
                <span className="sr-only"> filters</span>
              </button>
            </div>
            <SearchField
              key={`side-${searchKey}`}
              value={filters.q}
              onChange={(q) => updateInPlace({ q }, "search")}
            />
            <div className="mt-3.5">
              <FilterPanel key={`side-${panelKey}`} {...panelProps} onChange={updateInPlace} dense />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="sticky top-14 z-30 -mx-4 mb-3 border-b border-line bg-graphite-950/85 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
            <div className="flex gap-2">
              <SearchField
                key={`bar-${searchKey}`}
                className="min-w-0 flex-1"
                value={filters.q}
                onChange={(q) => update({ q }, "search")}
              />
              <button
                ref={filtersButton}
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                className="btn btn-secondary shrink-0 px-3.5"
              >
                <SlidersIcon size={16} />
                Filters
                {sheetCount > 0 && (
                  <span className="min-w-5 rounded-full bg-linear-to-r from-accent to-violet px-1.5 text-center text-[11px] font-bold leading-5 tabular-nums text-accent-ink">
                    {sheetCount}
                    <span className="sr-only"> active</span>
                  </span>
                )}
              </button>
            </div>
          </div>

          <section id="results" aria-labelledby="results-heading">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2
                  id="results-heading"
                  tabIndex={-1}
                  className="text-lg font-semibold tracking-tight text-fg outline-none sm:text-2xl"
                >
                  {title}
                </h2>
                {subtitle}
              </div>
              <SortSelect value={filters.sort} onChange={(sort) => updateInPlace({ sort })} className="shrink-0" />
            </div>

            <AssistantCallout className="mt-3" />

            {(categories.state.status === "loading" || (categoryList && categoryList.length > 1)) && (
              <div
                role="group"
                aria-label="Category"
                className="-mx-1 mt-2 flex h-13 items-center gap-2 overflow-x-auto px-1 lg:hidden"
              >
                {categoryList ? (
                  <>
                    <button
                      type="button"
                      className="chip shrink-0 max-sm:min-h-11"
                      aria-pressed={!filters.category}
                      onClick={() => update({ category: "" })}
                    >
                      All
                      {showCategoryCounts && totalProducts !== undefined && (
                        <span className="chip-count">{totalProducts}</span>
                      )}
                    </button>
                    {categoryList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="chip shrink-0 max-sm:min-h-11"
                        aria-pressed={filters.category === c.id}
                        onClick={() => update({ category: c.id })}
                      >
                        {c.label}
                        {showCategoryCounts && <span className="chip-count">{c.productCount}</span>}
                      </button>
                    ))}
                  </>
                ) : (
                  CHIP_PLACEHOLDERS.map((width) => (
                    <span
                      key={width}
                      aria-hidden="true"
                      className={`skeleton block h-9 shrink-0 rounded-full max-sm:h-11 ${width}`}
                    />
                  ))
                )}
              </div>
            )}

            {hasChips && (
              <div className="mt-3">
                <ActiveFilters
                  filters={filters}
                  onRemove={(patch, index) => {
                    pendingFocus.current = { kind: "chip", index };
                    updateInPlace(patch);
                  }}
                  onClearAll={() => clearAll({ kind: "results" })}
                />
              </div>
            )}

            <p role="status" className="sr-only">
              {announcement}
            </p>

            <div className="mt-4 sm:mt-5">
              <DiscoveryResults
                state={products.state}
                shown={shown}
                visible={visible}
                onRetry={products.retry}
                onReset={() => clearAll({ kind: "results" })}
              />
            </div>
          </section>

          <CategoryExplorer
            state={categories.state}
            active={filters.category}
            onRetry={categories.retry}
            onSelect={(category) => {
              pendingFocus.current = { kind: "results" };
              update({ category });
              scrollToResults();
            }}
          />
        </div>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={closeSheet}
        status={sheetOpen && count !== undefined ? `${plural(count, "product")} match` : ""}
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!canResetSheet) return;
                write({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort });
                setSheetPanelKey((k) => k + 1);
                setPanelKey((k) => k + 1);
              }}
              aria-disabled={!canResetSheet}
              className="btn btn-ghost aria-disabled:cursor-default aria-disabled:opacity-50"
            >
              Reset
              <span className="sr-only"> filters</span>
            </button>
            <button type="button" onClick={showResults} className="btn btn-primary flex-1">
              {count === undefined ? "Show products" : `Show ${plural(count, "product")}`}
            </button>
          </div>
        }
      >
        <FilterPanel key={`sheet-${sheetPanelKey}`} {...panelProps} onChange={update} priceRef={sheetPrice} />
      </FilterSheet>
    </>
  );
}
