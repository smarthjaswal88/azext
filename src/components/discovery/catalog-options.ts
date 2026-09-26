import type { CatalogCategory } from "@/lib/catalog-api";

export interface FilterOptions {
  types: { id: string; label: string; productCount: number }[];
  brands: string[];
  priceRangeCents: { min: number; max: number } | null;
}

/** Filter choices for the selected category, or across every category — all
 *  derived from the live categories response. */
export function filterOptionsFor(categories: CatalogCategory[], category: string): FilterOptions {
  const scope = category ? categories.filter((c) => c.id === category) : categories;

  const types = new Map<string, { id: string; label: string; productCount: number }>();
  for (const c of scope) {
    for (const t of c.productTypes) {
      const existing = types.get(t.id);
      if (existing) existing.productCount += t.productCount;
      else types.set(t.id, { ...t });
    }
  }

  const brands = [...new Set(scope.flatMap((c) => c.brands))].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );

  const priceRangeCents =
    scope.length === 0
      ? null
      : {
          min: Math.min(...scope.map((c) => c.priceRangeCents.min)),
          max: Math.max(...scope.map((c) => c.priceRangeCents.max)),
        };

  return {
    types: [...types.values()].sort((a, b) => a.label.localeCompare(b.label)),
    brands,
    priceRangeCents,
  };
}
