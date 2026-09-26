import type { CatalogCategoriesResponse } from "@/lib/catalog-api";
import { formatPrice } from "@/lib/format";
import type { AsyncState } from "@/lib/use-catalog";
import { ArrowRightIcon } from "../icons";
import { SectionHeading, StatePanel } from "../ui";

/** One card per live category; choosing one filters the results below. */
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
    <section aria-labelledby="explore-heading" className="mt-16">
      <SectionHeading
        id="explore-heading"
        eyebrow="Category explorer"
        title="Start from a category"
        description="Every category, type and brand here is read from the live catalog."
      />

      {state.status === "loading" && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <span key={i} aria-hidden="true" className="skeleton block h-44 rounded-[1.25rem]" />
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
        <ul className="grid gap-4 md:grid-cols-2">
          {state.data.categories.map((category) => {
            const selected = active === category.id;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => onSelect(selected ? "" : category.id)}
                  aria-pressed={selected}
                  className={`glass group flex h-full w-full flex-col p-6 text-left transition hover:border-line-strong hover:bg-white/6 ${
                    selected ? "glow border-accent/60" : ""
                  }`}
                >
                  <span className="flex w-full items-start justify-between gap-4">
                    <span>
                      <span className="block text-2xl font-semibold tracking-tight text-fg">{category.label}</span>
                      <span className="mt-1 block text-sm text-fg-muted">
                        {category.productCount} products · {category.brands.length} brands ·{" "}
                        {formatPrice(category.priceRangeCents.min)}–{formatPrice(category.priceRangeCents.max)}
                      </span>
                    </span>
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-2xl border transition ${
                        selected
                          ? "border-accent/70 bg-accent/20 text-accent-strong"
                          : "border-line-strong text-fg-muted group-hover:text-fg"
                      }`}
                    >
                      <ArrowRightIcon size={17} />
                    </span>
                  </span>
                  <span className="mt-5 flex flex-wrap gap-2">
                    {category.productTypes.map((type) => (
                      <span key={type.id} className="badge">
                        {type.label}
                        <span className="tabular-nums text-fg-subtle">{type.productCount}</span>
                      </span>
                    ))}
                  </span>
                  <span className="mt-5 text-xs font-medium text-accent-strong">
                    {selected ? "Showing this category — select again to show all" : "Explore this category"}
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
