import type { CatalogCategoriesResponse } from "@/lib/catalog-api";
import type { AsyncState } from "@/lib/use-catalog";
import { formatPrice } from "@/lib/format";
import { filterOptionsFor } from "./catalog-options";

/** Live counts from the categories endpoint, shown under the hero. */
export function LiveStats({ state }: { state: AsyncState<CatalogCategoriesResponse> }) {
  const data = state.status === "ready" ? state.data : undefined;
  const options = data ? filterOptionsFor(data.categories, "") : undefined;

  const stats = [
    { label: "Products", value: data ? String(data.totalProducts) : undefined },
    { label: "Categories", value: data ? String(data.categories.length) : undefined },
    { label: "Product types", value: options ? String(options.types.length) : undefined },
    { label: "Brands", value: options ? String(options.brands.length) : undefined },
    {
      label: "Price span",
      value: options?.priceRangeCents
        ? `${formatPrice(options.priceRangeCents.min)}–${formatPrice(options.priceRangeCents.max)}`
        : undefined,
    },
  ];

  if (state.status === "error") {
    return (
      <p role="status" className="glass px-5 py-4 text-sm text-fg-muted">
        Live catalog stats are unavailable right now: {state.error.message}
      </p>
    );
  }

  return (
    <dl className="glass grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {stats.map((stat) => (
        <div key={stat.label} className="px-5 py-4">
          <dt className="eyebrow">{stat.label}</dt>
          <dd className="mt-1.5 text-xl font-semibold tabular-nums text-fg">
            {stat.value ?? <span className="skeleton inline-block h-6 w-16 align-middle" />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
