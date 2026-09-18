import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Category, CategoryId } from "@/lib/types";

export type RawParams = Record<string, string | string[] | undefined>;

/** Builds a link that keeps the current search state and changes one thing.
 *  Passing null drops a parameter, which is how "clear this filter" works. */
export function hrefWith(params: RawParams, changes: Record<string, string | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) sp.set(k, s);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Rendered twice — once in the desktop rail, once inside the mobile
 *  disclosure — so `idPrefix` keeps label/input pairs unique. Category is a
 *  list of links and price is a small GET form, so both work without client
 *  JavaScript and both land in the URL. */
export function FilterPanel({
  idPrefix,
  params,
  categories,
  category,
  q,
  sort,
  minText,
  maxText,
  bounds,
  hasFilters,
}: {
  idPrefix: string;
  params: RawParams;
  categories: Category[];
  category?: CategoryId;
  q?: string;
  sort: string;
  minText?: string;
  maxText?: string;
  bounds: { minCents: number; maxCents: number };
  hasFilters: boolean;
}) {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-1.5 text-sm font-bold">Category</h2>
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link
              href={hrefWith(params, { category: null })}
              className={`block rounded px-1.5 py-1 hover:bg-surface-muted ${
                !category ? "font-semibold" : "text-ink-link"
              }`}
            >
              All categories
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={hrefWith(params, { category: c.id })}
                className={`block rounded px-1.5 py-1 hover:bg-surface-muted ${
                  category === c.id ? "font-semibold" : "text-ink-link"
                }`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-1.5 text-sm font-bold">Price</h2>
        <form action="/search" method="get" className="space-y-2">
          {q && <input type="hidden" name="q" value={q} />}
          {category && <input type="hidden" name="category" value={category} />}
          <input type="hidden" name="sort" value={sort} />
          <div className="flex items-center gap-1.5">
            <label className="sr-only" htmlFor={`${idPrefix}-min-price`}>
              Minimum price in dollars
            </label>
            <input
              id={`${idPrefix}-min-price`}
              name="min"
              inputMode="decimal"
              defaultValue={minText ?? ""}
              placeholder={`$${Math.floor(bounds.minCents / 100)}`}
              className="w-full min-w-0 rounded border border-border-strong bg-surface px-2 py-1 text-sm"
            />
            <span className="text-ink-muted">–</span>
            <label className="sr-only" htmlFor={`${idPrefix}-max-price`}>
              Maximum price in dollars
            </label>
            <input
              id={`${idPrefix}-max-price`}
              name="max"
              inputMode="decimal"
              defaultValue={maxText ?? ""}
              placeholder={`$${Math.ceil(bounds.maxCents / 100)}`}
              className="w-full min-w-0 rounded border border-border-strong bg-surface px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md border border-border-strong bg-surface-muted px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Apply
          </button>
        </form>
        <p className="mt-1.5 text-xs text-ink-muted">
          {formatPrice(bounds.minCents)} – {formatPrice(bounds.maxCents)} in this catalog
        </p>
      </section>

      {hasFilters && (
        <Link href="/search" className="inline-block text-sm text-ink-link hover:underline">
          Clear all filters
        </Link>
      )}
    </div>
  );
}
