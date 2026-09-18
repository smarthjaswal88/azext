import { formatCount } from "@/lib/format";
import { StarRow } from "./icons";

export function RatingLine({
  average,
  ratingCount,
  href,
  size = 15,
  showCount = true,
}: {
  average: number;
  ratingCount: number;
  href?: string;
  size?: number;
  showCount?: boolean;
}) {
  const label = `Rated ${average} out of 5 from ${formatCount(ratingCount)} ratings`;
  const inner = (
    <>
      <span className="text-sm font-medium tabular-nums">{average.toFixed(1)}</span>
      <StarRow value={average} size={size} />
      {showCount && (
        <span className="text-sm text-ink-link tabular-nums">{formatCount(ratingCount)}</span>
      )}
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

export { StarRow };
