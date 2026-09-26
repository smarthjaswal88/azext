/** Inline SVG icons: one stroke style, sized by `size`, coloured by
 *  currentColor, decorative unless given a label by the caller. */

import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 18, className, children, strokeWidth = 1.8 }: IconProps & { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);

export const CompareIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="7" height="15" rx="2" />
    <rect x="13.5" y="4.5" width="7" height="15" rx="2" />
  </Svg>
);

export const BagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 21 19.5H3z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.3" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 16-4.5-4.5-7.5 7.5" />
  </Svg>
);

/** The Nexus mark: three linked nodes. */
export function NexusMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="nexus-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9db3ff" />
          <stop offset="0.5" stopColor="#6f8dff" />
          <stop offset="1" stopColor="#a88bfa" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#12151d" stroke="url(#nexus-mark)" strokeWidth="1.5" />
      <path d="M10 21.5 16 10.5l6 11" fill="none" stroke="url(#nexus-mark)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 21.5h12" fill="none" stroke="url(#nexus-mark)" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      <circle cx="16" cy="10.5" r="2.4" fill="#9db3ff" />
      <circle cx="10" cy="21.5" r="2.4" fill="#6f8dff" />
      <circle cx="22" cy="21.5" r="2.4" fill="#a88bfa" />
    </svg>
  );
}
