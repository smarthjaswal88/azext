"use client";

import Link from "next/link";
import { catalogCategoryLabel, type CatalogProductDetail } from "@/lib/catalog-api";
import { MAX_COMPARE, MIN_COMPARE, useCompareItems, useCompareStore } from "@/lib/compare-selection";
import { useCatalogProductSet } from "@/lib/use-catalog";
import { CloseIcon, ExternalIcon } from "../icons";
import { AvailabilityDot, PriceTag, RatingSummary } from "../product-meta";
import { RemoteImage } from "../remote-image";
import { Skeleton, StatePanel } from "../ui";
import {
  FeatureColumns,
  InsightSummary,
  KeyDifferences,
  PRODUCT_TONES,
  SignalBars,
  SpecificationMatrix,
  Tradeoffs,
} from "./compare-analysis";
import { ComparePicker } from "./compare-picker";
import { DecisionAssistant } from "./decision-assistant";

/** The decision board: selection from the store, fresh details from the API. */
export function CompareBoard() {
  const items = useCompareItems();
  const slugs = items?.map((i) => i.slug) ?? [];
  const { state, retry } = useCatalogProductSet(slugs);
  const clear = useCompareStore((s) => s.clear);

  if (items === undefined) {
    return (
      <div className="mt-8 grid gap-4 md:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-[1.25rem]" />
        ))}
      </div>
    );
  }

  const category = items[0]?.category;

  return (
    <div className="mt-8 space-y-6">
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            Comparing {items.length} of {MAX_COMPARE} · {catalogCategoryLabel(category as string)}
          </p>
          <button type="button" onClick={clear} className="btn btn-ghost btn-sm">
            Clear comparison
          </button>
        </div>
      )}

      {items.length > 0 && state.status === "loading" && (
        <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
          <p role="status" className="sr-only">
            Loading products
          </p>
          {items.map((i) => (
            <Skeleton key={i.slug} className="h-80 rounded-[1.25rem]" />
          ))}
        </div>
      )}

      {items.length > 0 && state.status === "error" && (
        <StatePanel
          tone="error"
          title="The comparison could not be loaded"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={retry} className="btn btn-secondary">
                Try again
              </button>
              <button type="button" onClick={clear} className="btn btn-ghost">
                Clear comparison
              </button>
            </div>
          }
        >
          {state.error.status === 404
            ? "One of the selected products is no longer in the catalog. Clear the comparison and choose again."
            : state.error.message}
        </StatePanel>
      )}

      {state.status === "ready" && state.data.length > 0 && <ProductColumns products={state.data} />}

      {items.length < MAX_COMPARE && <ComparePicker items={items} />}

      {items.length === 1 && state.status === "ready" && (
        <p className="text-center text-sm text-fg-muted">
          Add at least {MIN_COMPARE - items.length} more product to see the comparison.
        </p>
      )}

      {state.status === "ready" && state.data.length >= MIN_COMPARE && (
        <>
          <DecisionAssistant products={state.data} />
          <InsightSummary products={state.data} />
          <SignalBars products={state.data} />
          <KeyDifferences products={state.data} />
          <Tradeoffs products={state.data} />
          <SpecificationMatrix products={state.data} />
          <FeatureColumns products={state.data} />
        </>
      )}
    </div>
  );
}

function ProductColumns({ products }: { products: CatalogProductDetail[] }) {
  const remove = useCompareStore((s) => s.remove);
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {products.map((p, i) => (
        <li key={p.slug} className={`glass relative flex flex-col border-t-2 p-3 ${PRODUCT_TONES[i].top}`}>
          <button
            type="button"
            onClick={() => remove(p.slug)}
            className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full border border-line-strong bg-graphite-800/90 text-fg-muted hover:text-fg"
          >
            <CloseIcon size={14} />
            <span className="sr-only">Remove {p.title} from the comparison</span>
          </button>
          <RemoteImage src={p.imageUrl} alt={p.title} priority sizes="(max-width: 768px) 92vw, 380px" className="aspect-4/3" />
          <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-4">
            <p className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${PRODUCT_TONES[i].dot}`} />
              {p.brand && <span className="eyebrow">{p.brand}</span>}
            </p>
            <h2 className="mt-1.5 line-clamp-3 text-sm font-medium leading-snug text-fg">
              <Link href={`/product/${p.slug}`} className="hover:underline">
                {p.title}
              </Link>
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <RatingSummary rating={p.rating} ratingCount={p.ratingCount} size="sm" />
              <AvailabilityDot availability={p.availability} />
            </div>
            <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
              <PriceTag priceCents={p.priceCents} listPriceCents={p.listPriceCents} />
              <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost btn-sm">
                <ExternalIcon size={14} />
                View source
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
