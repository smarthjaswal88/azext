/** Small, reusable presentations of listing facts. Server-safe. */

import type { CatalogAvailability } from "@/lib/catalog-api";
import { AVAILABILITY_LABELS, discountPercent } from "@/lib/compare-insights";
import { formatCount, formatPrice } from "@/lib/format";

/** Rating as a number and a thin bar; the full sentence is for screen readers. */
export function RatingSummary({
  rating,
  ratingCount,
  size = "md",
  countLabel = false,
}: {
  rating: number | null;
  ratingCount: number | null;
  size?: "sm" | "md";
  /** Show "ratings" after the count, where the number stands alone. */
  countLabel?: boolean;
}) {
  if (rating === null) {
    return <span className="text-xs text-fg-subtle">Not rated in the listing</span>;
  }
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className={`inline-flex items-center gap-2 ${size === "sm" ? "text-xs" : "text-sm"}`}>
      <span className="font-semibold tabular-nums text-fg">{rating.toFixed(1)}</span>
      <span
        aria-hidden="true"
        className={`relative overflow-hidden rounded-full bg-tint/10 ${size === "sm" ? "h-1.5 w-12" : "h-2 w-16"}`}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-accent to-violet"
          style={{ width: `${pct}%` }}
        />
      </span>
      {ratingCount !== null && (
        <span aria-hidden="true" className="tabular-nums text-fg-subtle">
          {formatCount(ratingCount)}
          {countLabel && ` ${ratingCount === 1 ? "rating" : "ratings"}`}
        </span>
      )}
      <span className="sr-only">
        out of 5{ratingCount !== null ? `, from ${formatCount(ratingCount)} ratings` : ""}
      </span>
    </span>
  );
}

export function PriceTag({
  priceCents,
  listPriceCents,
  size = "md",
}: {
  priceCents: number;
  listPriceCents: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const discount = discountPercent({ priceCents, listPriceCents });
  const priceClass = size === "lg" ? "text-4xl" : size === "md" ? "text-xl" : "text-lg";
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`${priceClass} font-semibold tracking-tight tabular-nums text-fg`}>
        {formatPrice(priceCents)}
      </span>
      {discount !== null && listPriceCents !== null && (
        <>
          <span className="text-sm tabular-nums text-fg-subtle line-through decoration-fg-subtle/70">
            <span className="sr-only">Previous price </span>
            {formatPrice(listPriceCents)}
          </span>
          <span className="badge badge-accent">−{discount}%</span>
        </>
      )}
    </span>
  );
}

const AVAILABILITY_TONES: Record<CatalogAvailability, string> = {
  in_stock: "bg-positive",
  limited_stock: "bg-caution",
  out_of_stock: "bg-negative",
  unknown: "bg-fg-subtle",
};

export function AvailabilityDot({ availability }: { availability: CatalogAvailability }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <span aria-hidden="true" className={`size-2 rounded-full ${AVAILABILITY_TONES[availability]}`} />
      {AVAILABILITY_LABELS[availability]}
    </span>
  );
}
