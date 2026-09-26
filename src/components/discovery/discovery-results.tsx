import type { CatalogProductSummary } from "@/lib/catalog-api";
import type { ProductCollection } from "@/lib/catalog-client";
import type { AsyncState } from "@/lib/use-catalog";
import { ProductCard, ProductCardSkeleton } from "../product-card";
import { StatePanel } from "../ui";

export function DiscoveryResults({
  state,
  visible,
  onRetry,
  onReset,
}: {
  state: AsyncState<ProductCollection>;
  /** The loaded products after the in-browser filters. */
  visible: CatalogProductSummary[] | undefined;
  onRetry: () => void;
  onReset: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div aria-busy="true">
        <p role="status" className="sr-only">
          Loading products
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
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
  if (products.length === 0) {
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
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <li key={product.id}>
            <ProductCard product={product} priority={index < 4} />
          </li>
        ))}
      </ul>
      {state.data.truncated && (
        <p className="mt-4 text-xs text-fg-subtle">
          Showing the first {state.data.products.length} of {state.data.total} matches. Narrow the
          search to see the rest.
        </p>
      )}
    </>
  );
}
