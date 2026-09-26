"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { CatalogCategory } from "@/lib/catalog-api";
import {
  RATING_OPTIONS,
  activeFilterCount,
  type DiscoveryFilters,
  type RatingFilter,
} from "@/lib/discovery-filters";
import { formatPrice } from "@/lib/format";
import { SORT_OPTIONS } from "@/lib/sort";
import type { SortKey } from "@/lib/types";
import { SearchIcon, SlidersIcon } from "../icons";
import type { FilterOptions } from "./catalog-options";

/**
 * The control deck: search, then category, type, rating, brand, price and
 * sort. Every change is written to the URL by the parent, which is the only
 * source of truth; the text fields keep a local draft while typing.
 */
export function DiscoveryControls({
  filters,
  categories,
  options,
  priceProblem,
  onChange,
  onReset,
}: {
  filters: DiscoveryFilters;
  categories: CatalogCategory[] | undefined;
  options: FilterOptions | undefined;
  priceProblem?: string;
  onChange: (patch: Partial<DiscoveryFilters>) => void;
  onReset: () => void;
}) {
  const id = useId();

  // Local drafts follow the URL whenever it changes from elsewhere (reset,
  // back button) — adjusted during render, not in an effect.
  const [draft, setDraft] = useState({ q: filters.q, min: filters.min, max: filters.max });
  const [synced, setSynced] = useState({ q: filters.q, min: filters.min, max: filters.max });
  if (synced.q !== filters.q || synced.min !== filters.min || synced.max !== filters.max) {
    setSynced({ q: filters.q, min: filters.min, max: filters.max });
    setDraft({ q: filters.q, min: filters.min, max: filters.max });
  }

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearchInput(value: string) {
    setDraft((d) => ({ ...d, q: value }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ q: value.trim() }), 350);
  }

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    clearTimeout(timer.current);
    onChange({ q: draft.q.trim() });
  }

  function onPriceSubmit(event: FormEvent) {
    event.preventDefault();
    onChange({ min: draft.min.trim(), max: draft.max.trim() });
  }

  const active = activeFilterCount(filters);

  return (
    <div className="glass-strong p-4 sm:p-5">
      <form role="search" onSubmit={onSearchSubmit} className="relative">
        <label htmlFor={`${id}-q`} className="sr-only">
          Search products
        </label>
        <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input
          id={`${id}-q`}
          type="search"
          value={draft.q}
          onChange={(e) => onSearchInput(e.target.value)}
          maxLength={100}
          placeholder="Search by name, brand or feature"
          className="field h-12 pl-11 text-base"
        />
      </form>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <fieldset>
          <legend className="eyebrow">Category</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={!filters.category} onClick={() => onChange({ category: "" })}>
              All
            </button>
            {categories?.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={filters.category === c.id}
                onClick={() => onChange({ category: c.id })}
              >
                {c.label}
                <span className="chip-count">{c.productCount}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow">Product type</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={!filters.type} onClick={() => onChange({ type: "" })}>
              All types
            </button>
            {options?.types.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                aria-pressed={filters.type === t.id}
                onClick={() => onChange({ type: t.id })}
              >
                {t.label}
                <span className="chip-count">{t.productCount}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow">Rating</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {RATING_OPTIONS.map((option) => (
              <button
                key={option.value || "any"}
                type="button"
                className="chip"
                aria-pressed={filters.rating === option.value}
                onClick={() => onChange({ rating: option.value as RatingFilter })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-brand`} className="eyebrow">
              Brand
            </label>
            <select
              id={`${id}-brand`}
              value={filters.brand}
              onChange={(e) => onChange({ brand: e.target.value })}
              className="field mt-2"
            >
              <option value="">All brands</option>
              {options?.brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-sort`} className="eyebrow">
              Sort
            </label>
            <select
              id={`${id}-sort`}
              value={filters.sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className="field mt-2"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <form onSubmit={onPriceSubmit} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
        <fieldset className="flex items-end gap-2">
          <legend className="eyebrow mb-2">Price (USD)</legend>
          <label className="sr-only" htmlFor={`${id}-min`}>
            Minimum price in dollars
          </label>
          <input
            id={`${id}-min`}
            inputMode="decimal"
            value={draft.min}
            onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
            placeholder={options?.priceRangeCents ? formatPrice(options.priceRangeCents.min) : "Min"}
            className="field w-28"
          />
          <span aria-hidden="true" className="pb-3 text-fg-subtle">
            –
          </span>
          <label className="sr-only" htmlFor={`${id}-max`}>
            Maximum price in dollars
          </label>
          <input
            id={`${id}-max`}
            inputMode="decimal"
            value={draft.max}
            onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
            placeholder={options?.priceRangeCents ? formatPrice(options.priceRangeCents.max) : "Max"}
            className="field w-28"
          />
        </fieldset>
        <button type="submit" className="btn btn-secondary">
          <SlidersIcon size={16} />
          Apply price
        </button>
        <div className="ml-auto flex items-center gap-3">
          {active > 0 && (
            <span className="text-xs text-fg-subtle">
              {active} filter{active === 1 ? "" : "s"} on
            </span>
          )}
          <button type="button" onClick={onReset} disabled={active === 0 && filters.sort === "featured"} className="btn btn-ghost btn-sm">
            Reset all
          </button>
        </div>
        {priceProblem && (
          <p role="status" className="w-full text-xs text-caution">
            {priceProblem}
          </p>
        )}
      </form>
    </div>
  );
}
