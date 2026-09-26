"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Ref,
} from "react";
import type { CatalogCategory } from "@/lib/catalog-api";
import {
  MAX_FILTER_DOLLARS,
  RATING_OPTIONS,
  isDollarAmount,
  type DiscoveryFilters,
  type RatingFilter,
} from "@/lib/discovery-filters";
import { formatPrice, parseDollarsToCents } from "@/lib/format";
import { SORT_OPTIONS } from "@/lib/sort";
import type { SortKey } from "@/lib/types";
import { CloseIcon, SearchIcon } from "../icons";
import type { FilterOptions } from "./catalog-options";

/** How long typing pauses before the search is applied. */
export const SEARCH_DEBOUNCE_MS = 275;

/** Short chip text for each rating option; the full label is what is announced. */
const RATING_CHIP_TEXT: Record<RatingFilter, string> = { "": "Any", "4": "4.0+", "4.5": "4.5+" };

/** Compact names for the results-header sort control. */
const SORT_SHORT_LABELS: Record<SortKey, string> = {
  featured: "Most rated",
  "price-asc": "Lowest price",
  "price-desc": "Highest price",
  "rating-desc": "Highest rated",
};

/** "$20", "20.00" or "1,200" as typed, in the plain form the URL accepts. */
function cleanDollars(value: string): string {
  return value.trim().replace(/^\$/, "").replace(/,/g, "").trim();
}

/**
 * Search over titles, brands and descriptions. Typing is debounced into the
 * URL; Enter applies at once.
 *
 * The field remembers the values it sent. When the URL reports one of them,
 * that is the field's own update arriving, and whatever has been typed since
 * is kept. Any other value came from elsewhere — a reset, a removed chip, the
 * back button — and replaces the draft and cancels a pending update. A
 * parent that must cancel a pending update without changing the value (a
 * reset while the search was already empty) remounts the field with a key.
 */
export function SearchField({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (q: string) => void;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(value);
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const [sent, setSent] = useState<string[]>([]);
  const [adopted, setAdopted] = useState(0);

  if (synced !== value) {
    setSynced(value);
    const own = sent.indexOf(value);
    if (own >= 0) {
      setSent(sent.slice(own + 1));
    } else {
      setSent([]);
      setDraft(value);
      setAdopted((n) => n + 1);
    }
  }

  useEffect(() => {
    latest.current = value;
  }, [value]);

  // A value from elsewhere wins over a pending update of the old text.
  useEffect(() => {
    if (adopted > 0) clearTimeout(timer.current);
  }, [adopted]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function emit(q: string) {
    if (q === latest.current) return;
    setSent((list) => [...list, q]);
    onChange(q);
  }

  function onInput(next: string) {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => emit(next.trim()), SEARCH_DEBOUNCE_MS);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearTimeout(timer.current);
    emit(draft.trim());
    // Closes the on-screen keyboard; a hardware keyboard keeps its place.
    if (window.matchMedia("(pointer: coarse)").matches) input.current?.blur();
  }

  function clear() {
    clearTimeout(timer.current);
    setDraft("");
    emit("");
    input.current?.focus();
  }

  return (
    <form role="search" onSubmit={onSubmit} className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <SearchIcon
        size={17}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      <input
        ref={input}
        id={id}
        type="search"
        enterKeyHint="search"
        value={draft}
        onChange={(e) => onInput(e.target.value)}
        maxLength={100}
        placeholder="Search products"
        className="field h-11 pl-10 pr-11"
      />
      {draft && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-fg-subtle transition hover:bg-tint/8 hover:text-fg"
        >
          <CloseIcon size={14} />
          <span className="sr-only">Clear search</span>
        </button>
      )}
    </form>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <legend className="eyebrow float-left mb-2 w-full">{legend}</legend>
      <div className="clear-both flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

export type PriceCommit = "applied" | "unchanged" | "invalid";

export interface PriceFilterHandle {
  /** Applies a typed range, as the sheet's primary action does. */
  commit: () => PriceCommit;
}

function PriceFilter({
  min,
  max,
  rangeCents,
  problem,
  onApply,
  ref,
}: {
  min: string;
  max: string;
  rangeCents: FilterOptions["priceRangeCents"] | undefined;
  problem?: string;
  onApply: (range: { min: string; max: string }) => void;
  ref?: Ref<PriceFilterHandle>;
}) {
  const id = useId();
  const minInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ min, max });
  const [synced, setSynced] = useState({ min, max });
  const [error, setError] = useState("");
  if (synced.min !== min || synced.max !== max) {
    setSynced({ min, max });
    setDraft({ min, max });
    setError("");
  }

  const cleaned = { min: cleanDollars(draft.min), max: cleanDollars(draft.max) };
  const dirty = cleaned.min !== min || cleaned.max !== max;

  function commit(): PriceCommit {
    if (!dirty) return "unchanged";
    const bad = [cleaned.min, cleaned.max].find((v) => v && !isDollarAmount(v));
    if (bad !== undefined) {
      setError(
        Number(bad) > MAX_FILTER_DOLLARS
          ? `Enter a price up to ${formatPrice(MAX_FILTER_DOLLARS * 100)}.`
          : "Enter whole dollars or dollars and cents, like 25 or 25.50.",
      );
      minInput.current?.focus();
      return "invalid";
    }
    const low = parseDollarsToCents(cleaned.min);
    const high = parseDollarsToCents(cleaned.max);
    if (low !== undefined && high !== undefined && low > high) {
      setError("The minimum is above the maximum. Swap them or clear one.");
      minInput.current?.focus();
      return "invalid";
    }
    setError("");
    setDraft(cleaned);
    onApply(cleaned);
    return "applied";
  }

  useImperativeHandle(ref, () => ({ commit }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    commit();
  }

  const message = error || problem || "";

  return (
    <form onSubmit={onSubmit} noValidate className="border-t border-line pt-3">
      <fieldset>
        <legend className="float-left mb-2 flex w-full items-baseline justify-between gap-2">
          <span className="eyebrow">Price (USD)</span>
          {rangeCents && (
            <span className="text-[0.7rem] tabular-nums text-fg-subtle">
              {formatPrice(rangeCents.min)} – {formatPrice(rangeCents.max)}
            </span>
          )}
        </legend>
        <div className="clear-both flex items-center gap-1.5">
          {(["min", "max"] as const).map((key, index) => (
            <div key={key} className="contents">
              {index === 1 && (
                <span aria-hidden="true" className="text-fg-subtle">
                  –
                </span>
              )}
              <div className="relative min-w-0 flex-1">
                <label className="sr-only" htmlFor={`${id}-${key}`}>
                  {key === "min" ? "Minimum price in dollars" : "Maximum price in dollars"}
                </label>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle"
                >
                  $
                </span>
                <input
                  ref={key === "min" ? minInput : undefined}
                  id={`${id}-${key}`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft[key]}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, [key]: e.target.value }));
                    if (error) setError("");
                  }}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={`${id}-message`}
                  placeholder={key === "min" ? "Min" : "Max"}
                  className="field pl-6"
                />
              </div>
            </div>
          ))}
          {/* Not `disabled`: a control that disables itself while focused
              drops keyboard focus. With nothing to apply it does nothing. */}
          <button
            type="submit"
            aria-disabled={!dirty}
            className="btn btn-secondary shrink-0 px-3 aria-disabled:cursor-default aria-disabled:opacity-50"
          >
            Apply
            <span className="sr-only"> price</span>
          </button>
        </div>
      </fieldset>
      {/* Always present, so a new message is announced when it appears. */}
      <p id={`${id}-message`} role="status" className="mt-2 text-xs text-caution empty:hidden">
        {message}
      </p>
    </form>
  );
}

/**
 * Category, product type, brand, rating and price. Every change is written to
 * the URL by the parent, which is the only source of truth; the price fields
 * keep a local draft until applied. Shared by the desktop sidebar and the
 * mobile filter sheet.
 *
 * Counts are shown only where they are true for the current results: product
 * type counts come from the loaded results; category counts, which cover the
 * whole catalog, are shown only when no other filter narrows it.
 */
export function FilterPanel({
  filters,
  categories,
  options,
  typeCounts,
  showCategoryCounts,
  priceProblem,
  onChange,
  priceRef,
  dense = false,
}: {
  filters: DiscoveryFilters;
  categories: CatalogCategory[] | undefined;
  options: FilterOptions | undefined;
  /** Products per type in the loaded results, before the type filter. */
  typeCounts: Map<string, number> | undefined;
  showCategoryCounts: boolean;
  priceProblem?: string;
  onChange: (patch: Partial<DiscoveryFilters>) => void;
  priceRef?: Ref<PriceFilterHandle>;
  /** Smaller chips and fields, for a pointer in the desktop sidebar. */
  dense?: boolean;
}) {
  const id = useId();
  const chip = dense ? "chip chip-dense" : "chip";
  const field = dense ? "field min-h-10 py-2" : "field";
  const total = categories?.reduce((sum, c) => sum + c.productCount, 0);

  return (
    <div className="flex flex-col gap-3">
      <Group legend="Category">
        <button type="button" className={chip} aria-pressed={!filters.category} onClick={() => onChange({ category: "" })}>
          All
          {showCategoryCounts && total !== undefined && <span className="chip-count">{total}</span>}
        </button>
        {categories?.map((c) => (
          <button
            key={c.id}
            type="button"
            className={chip}
            aria-pressed={filters.category === c.id}
            onClick={() => onChange({ category: c.id })}
          >
            {c.label}
            {showCategoryCounts && <span className="chip-count">{c.productCount}</span>}
          </button>
        ))}
        {!categories && <span className="skeleton block h-8 w-full rounded-full" />}
      </Group>

      <div className="border-t border-line pt-3">
        <label htmlFor={`${id}-type`} className="eyebrow mb-2 block">
          Product type
        </label>
        <select
          id={`${id}-type`}
          value={filters.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className={field}
        >
          <option value="">All types</option>
          {options?.types.map((t) => (
            <option key={t.id} value={t.id}>
              {typeCounts ? `${t.label} (${typeCounts.get(t.id) ?? 0})` : t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-line pt-3">
        <label htmlFor={`${id}-brand`} className="eyebrow mb-2 block">
          Brand
        </label>
        <select
          id={`${id}-brand`}
          value={filters.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          className={field}
        >
          <option value="">All brands</option>
          {options?.brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
      </div>

      <Group legend="Rating">
        {RATING_OPTIONS.map((option) => (
          <button
            key={option.value || "any"}
            type="button"
            className={chip}
            aria-label={option.label}
            aria-pressed={filters.rating === option.value}
            onClick={() => onChange({ rating: option.value as RatingFilter })}
          >
            {RATING_CHIP_TEXT[option.value]}
          </button>
        ))}
      </Group>

      <PriceFilter
        ref={priceRef}
        min={filters.min}
        max={filters.max}
        rangeCents={options?.priceRangeCents}
        problem={priceProblem}
        onApply={(range) => onChange(range)}
      />
    </div>
  );
}

/** Sort order, beside the result count. */
export function SortSelect({
  value,
  onChange,
  className = "",
}: {
  value: SortKey;
  onChange: (sort: SortKey) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor={id}
        className="sr-only text-xs font-medium text-fg-subtle sm:not-sr-only sm:whitespace-nowrap"
      >
        Sort by
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="field w-auto min-w-0 py-2"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {SORT_SHORT_LABELS[option.key]}
          </option>
        ))}
      </select>
    </div>
  );
}
