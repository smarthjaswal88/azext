import type { CatalogCategoriesResponse } from "@/lib/catalog-api";
import { formatPrice } from "@/lib/format";
import type { AsyncState } from "@/lib/use-catalog";
import { ArrowRightIcon, CheckIcon } from "../icons";
import { StatePanel } from "../ui";

/**
 * One compact card per live category, below the results. Choosing one
 * filters the results above; choosing it again shows every category.
 */
export function CategoryExplorer({
  state,
  active,
  onSelect,
  onRetry,
}: {
  state: AsyncState<CatalogCategoriesResponse>;
  active: string;
  onSelect: (category: string) => void;
  onRetry: () => void;
}) {
  return (
    <section aria-labelledby="explore-heading" className="mt-14">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="explore-heading" className="text-lg font-semibold tracking-tight text-fg">
          Browse by category
        </h2>
        <p className="text-xs text-fg-subtle">Catalog-wide counts, read from the live catalog.</p>
      </div>

      {state.status === "loading" && (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <span key={i} aria-hidden="true" className="skeleton block h-28 rounded-[1.25rem]" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <StatePanel
          tone="error"
          title="Categories could not be loaded"
          action={
            <button type="button" onClick={onRetry} className="btn btn-secondary">
              Try again
            </button>
          }
        >
          {state.error.message}
        </StatePanel>
      )}

      {state.status === "ready" && state.data.categories.length === 0 && (
        <StatePanel title="The catalog is empty">No categories have been imported yet.</StatePanel>
      )}

      {state.status === "ready" && state.data.categories.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {state.data.categories.map((category) => {
            const selected = active === category.id;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => onSelect(selected ? "" : category.id)}
                  aria-pressed={selected}
                  className={`glass group flex h-full w-full items-start gap-4 p-4 text-left transition hover:border-line-strong hover:bg-tint/6 sm:p-5 ${
                    selected ? "glow border-accent/60" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold tracking-tight text-fg">{category.label}</span>
                    <span className="mt-0.5 block text-xs text-fg-muted">
                      {category.productCount} products · {category.brands.length} brands ·{" "}
                      {formatPrice(category.priceRangeCents.min)} – {formatPrice(category.priceRangeCents.max)}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {category.productTypes.map((type) => (
                        <span key={type.id} className="tag">
                          {type.label}
                          <span className="ml-1.5 tabular-nums text-fg-subtle">{type.productCount}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl border transition ${
                      selected
                        ? "border-accent/70 bg-accent/20 text-accent-strong"
                        : "border-line-strong text-fg-muted group-hover:text-fg"
                    }`}
                  >
                    {selected ? <CheckIcon size={16} /> : <ArrowRightIcon size={16} />}
                    <span className="sr-only">{selected ? "Showing this category" : "Show this category"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
