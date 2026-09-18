import { formatCount } from "@/lib/format";

/** Five stars with a partial fill for the fractional part. Decorative: the
 *  numeric value is always given in text alongside it. */
export function StarRating({
  value,
  size = 16,
}: {
  value: number;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className="relative inline-block leading-none align-middle"
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      <span className="text-border-subtle">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden text-star"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

export function RatingLine({
  average,
  ratingCount,
  href,
  size = 16,
}: {
  average: number;
  ratingCount: number;
  href?: string;
  size?: number;
}) {
  const label = `${average} out of 5, ${formatCount(ratingCount)} ratings`;
  const inner = (
    <>
      <span className="text-sm font-medium">{average.toFixed(1)}</span>
      <StarRating value={average} size={size} />
      <span className="text-sm text-muted-ink">({formatCount(ratingCount)})</span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-1.5 hover:underline" aria-label={label}>
      {inner}
    </a>
  ) : (
    <span className="flex items-center gap-1.5" aria-label={label}>
      {inner}
    </span>
  );
}
