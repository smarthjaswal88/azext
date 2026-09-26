import { catalogCategoryLabel, catalogProductTypeLabel } from "@/lib/catalog-api";
import { RATING_OPTIONS, priceRange, type DiscoveryFilters } from "@/lib/discovery-filters";
import { formatPrice, parseDollarsToCents } from "@/lib/format";
import { AlertIcon, CloseIcon } from "../icons";

interface ActiveFilter {
  key: string;
  label: string;
  clear: Partial<DiscoveryFilters>;
  /** In the URL but not applied (a minimum above the maximum). */
  ignored?: boolean;
}

function priceLabel(min: string, max: string): string {
  const low = parseDollarsToCents(min);
  const high = parseDollarsToCents(max);
  if (low !== undefined && high !== undefined) return `${formatPrice(low)} – ${formatPrice(high)}`;
  if (low !== undefined) return `From ${formatPrice(low)}`;
  return `Up to ${formatPrice(high ?? 0)}`;
}

/** Every filter in the URL, in display order, including one that is ignored. */
export function activeFiltersOf(filters: DiscoveryFilters): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (filters.q) out.push({ key: "q", label: `“${filters.q}”`, clear: { q: "" } });
  if (filters.category) {
    out.push({ key: "category", label: catalogCategoryLabel(filters.category), clear: { category: "" } });
  }
  if (filters.type) out.push({ key: "type", label: catalogProductTypeLabel(filters.type), clear: { type: "" } });
  if (filters.brand) out.push({ key: "brand", label: filters.brand, clear: { brand: "" } });
  if (filters.min || filters.max) {
    const ignored = priceRange(filters).problem !== undefined;
    out.push({
      key: "price",
      label: ignored ? "Price range ignored: minimum above maximum" : priceLabel(filters.min, filters.max),
      clear: { min: "", max: "" },
      ignored,
    });
  }
  if (filters.rating) {
    const option = RATING_OPTIONS.find((o) => o.value === filters.rating);
    out.push({ key: "rating", label: `Rated ${option?.label ?? filters.rating}`, clear: { rating: "" } });
  }
  return out;
}

/** The filters that actually narrow the results. */
export function appliedFilterCount(filters: DiscoveryFilters): number {
  return activeFiltersOf(filters).filter((f) => !f.ignored).length;
}

/**
 * One removable chip per filter in the URL, and a way to clear them all.
 * Removing a chip reports its position so the parent can move focus to its
 * neighbour once the chip is gone.
 */
export function ActiveFilters({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: DiscoveryFilters;
  onRemove: (patch: Partial<DiscoveryFilters>, index: number) => void;
  onClearAll: () => void;
}) {
  const active = activeFiltersOf(filters);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label="Active filters" className="flex min-w-0 flex-wrap gap-2">
        {active.map((filter, index) => (
          <li key={filter.key} className="min-w-0 max-w-full">
            <button
              type="button"
              data-active-filter=""
              onClick={() => onRemove(filter.clear, index)}
              aria-label={`Remove filter: ${filter.label}`}
              className={`chip max-w-full pr-2 max-sm:min-h-11 ${
                filter.ignored ? "border-caution/50 bg-caution/10 text-caution" : "border-accent/45 bg-accent/10 text-fg"
              }`}
            >
              {filter.ignored && <AlertIcon size={13} className="shrink-0" />}
              <span className="truncate">{filter.label}</span>
              <CloseIcon size={13} className="shrink-0 text-fg-muted" />
            </button>
          </li>
        ))}
      </ul>
      {active.length > 1 && (
        <button type="button" onClick={onClearAll} className="btn btn-ghost btn-sm max-sm:min-h-11">
          Clear all
        </button>
      )}
    </div>
  );
}
