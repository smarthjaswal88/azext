/** Inline SVG icons. One consistent set, sized by the `size` prop and inheriting
 *  `currentColor`, so nothing depends on emoji rendering differing per platform. */

interface IconProps {
  size?: number;
  className?: string;
}

export function CartIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.5 3h2.2l2.1 10.4a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.25l1.4-6.2H6" />
      <circle cx="9.5" cy="19.5" r="1.5" />
      <circle cx="17" cy="19.5" r="1.5" />
    </svg>
  );
}

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 21 21" />
    </svg>
  );
}

export function FilterIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m4 12.5 5.2 5.2L20 7" />
    </svg>
  );
}

const STAR_PATH =
  "M12 2.6l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.43 6.19 20.48 7.3 14.01 2.6 9.43l6.5-.95z";

/** Five stars with a clipped overlay for the fractional part. Decorative — the
 *  numeric value always appears as text beside it. */
export function StarRow({ value, size = 15 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const id = `star-clip-${Math.round(pct * 100)}-${size}`;
  return (
    <svg
      width={size * 5}
      height={size}
      viewBox="0 0 120 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={(pct / 100) * 120} height="24" />
        </clipPath>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={`bg-${i}`}
          d={STAR_PATH}
          transform={`translate(${i * 24} 0)`}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="1.6"
        />
      ))}
      <g clipPath={`url(#${id})`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`fg-${i}`} d={STAR_PATH} transform={`translate(${i * 24} 0)`} fill="var(--star)" />
        ))}
      </g>
    </svg>
  );
}

export function CompareIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 5h6v14H4zM14 5h6v14h-6z" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
