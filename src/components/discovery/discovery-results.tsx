import type { CatalogProductSummary } from "@/lib/catalog-api";
import type { ProductCollection } from "@/lib/catalog-client";
import type { AsyncState } from "@/lib/use-catalog";
import { ProductCard, ProductCardSkeleton } from "../product-card";
import { StatePanel } from "../ui";

/** One column of row cards on phones; above that, as many 15rem-or-wider
 *  column cards as the results column holds (two beside the sidebar at
 *  1024px, three from about 1180px). */
export const RESULTS_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] sm:gap-4";

export function ResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={RESULTS_GRID} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * While a new query loads, the previous results stay in place, dimmed, so a
 * sort or filter change never blanks the grid; skeletons show only when
 * there is nothing yet to show.
 */
export function DiscoveryResults({
  state,
  shown,
  visible,
  onRetry,
  onReset,
}: {
  state: AsyncState<ProductCollection>;
  /** The collection on screen: the loaded one, or the last one while loading. */
  shown: ProductCollection | undefined;
  /** `shown` after the in-browser filters. */
  visible: CatalogProductSummary[] | undefined;
  onRetry: () => void;
  onReset: () => void;
}) {
  if (state.status === "loading" && !visible) {
    return (
      <div aria-busy="true">
        <ResultsSkeleton />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel
        tone="error"
        title="Products could not be loaded"
        action={
          <button type="button" onClick={onRetry} className="btn btn-secondary">
            Try again
          </button>
        }
      >
        {state.error.message} Nothing is shown in its place — the catalog is the only source.
      </StatePanel>
    );
  }

  const products = visible ?? [];
  const updating = state.status === "loading";
  if (products.length === 0 && !updating) {
    return (
      <StatePanel
        title="No products match"
        action={
          <button type="button" onClick={onReset} className="btn btn-secondary">
            Clear filters
          </button>
        }
      >
        Try a shorter search, another category or a wider price range.
      </StatePanel>
    );
  }

  return (
    <div aria-busy={updating || undefined} className={`transition-opacity duration-200 ${updating ? "opacity-55" : ""}`}>
      <ul className={RESULTS_GRID}>
        {products.map((product, index) => (
          <li key={product.id}>
            <ProductCard product={product} priority={index < 3} />
          </li>
        ))}
      </ul>
      {shown?.truncated && (
        <p className="mt-4 text-xs text-fg-subtle">
          Showing the first {shown.products.length} of {shown.total} matches. Narrow the search to see
          the rest.
        </p>
      )}
    </div>
  );
}
