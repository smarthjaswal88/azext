"use client";

import { useState } from "react";
import { catalogCategoryLabel, catalogProductTypeLabel } from "@/lib/catalog-api";
import { MAX_COMPARE, useCompareStore, type CompareItem } from "@/lib/compare-selection";
import { formatPrice } from "@/lib/format";
import { useCatalogCategories, useCatalogProducts } from "@/lib/use-catalog";
import { PlusIcon } from "../icons";
import { RatingSummary } from "../product-meta";
import { RemoteImage } from "../remote-image";
import { Skeleton } from "../ui";

/**
 * Chooses products for the comparison from the live catalog. With nothing
 * selected, a category comes first; after that only that category is offered,
 * because products are compared within one category.
 */
export function ComparePicker({ items }: { items: CompareItem[] }) {
  const lockedCategory = items[0]?.category;
  const [chosenCategory, setChosenCategory] = useState<string>();
  const category = lockedCategory ?? chosenCategory;

  const categories = useCatalogCategories();

  return (
    <section aria-labelledby="picker-heading" className="glass p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Add products</p>
          <h2 id="picker-heading" className="mt-1.5 text-lg font-semibold text-fg">
            {category ? `Choose from ${catalogCategoryLabel(category).toLowerCase()}` : "Choose a category to compare in"}
          </h2>
        </div>
        <p className="text-sm text-fg-muted">
          {items.length} of {MAX_COMPARE} selected
        </p>
      </div>

      {!lockedCategory && (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.state.status === "loading" && <Skeleton className="h-9 w-56 rounded-full" />}
          {categories.state.status === "error" && (
            <p role="alert" className="text-sm text-negative">
              {categories.state.error.message}{" "}
              <button type="button" onClick={categories.retry} className="link">
                Try again
              </button>
            </p>
          )}
          {categories.state.status === "ready" &&
            categories.state.data.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={category === c.id}
                onClick={() => setChosenCategory(c.id)}
              >
                {c.label}
                <span className="chip-count">{c.productCount}</span>
              </button>
            ))}
        </div>
      )}

      {category && <CandidateList category={category} items={items} />}
    </section>
  );
}

function CandidateList({ category, items }: { category: string; items: CompareItem[] }) {
  const { state, retry } = useCatalogProducts({ category, sort: "featured" });
  const add = useCompareStore((s) => s.add);
  const full = items.length >= MAX_COMPARE;

  if (state.status === "loading") {
    return (
      <div className="mt-5 grid gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-5 text-sm text-negative">
        {state.error.message}{" "}
        <button type="button" onClick={retry} className="link">
          Try again
        </button>
      </p>
    );
  }

  const candidates = state.data.products.filter((p) => !items.some((i) => i.slug === p.slug));
  if (candidates.length === 0) {
    return <p className="mt-5 text-sm text-fg-muted">Every product in this category is already selected.</p>;
  }

  return (
    <ul className="mt-5 grid max-h-[26rem] gap-2 overflow-y-auto pr-1">
      {candidates.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white/2 p-2">
          <RemoteImage src={p.imageUrl} alt="" sizes="56px" className="size-14 shrink-0" padding="p-1" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{p.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
              <span className="tabular-nums text-fg-muted">{formatPrice(p.priceCents)}</span>
              <span>{catalogProductTypeLabel(p.productType)}</span>
              <RatingSummary rating={p.rating} ratingCount={p.ratingCount} size="sm" />
            </p>
          </div>
          <button
            type="button"
            disabled={full}
            onClick={() => add({ slug: p.slug, category: p.category, title: p.title, imageUrl: p.imageUrl })}
            className="btn btn-secondary btn-sm shrink-0"
          >
            <PlusIcon size={14} />
            Add
            <span className="sr-only"> {p.title} to the comparison</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
