"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCartItems } from "@/lib/cart-store";
import { MAX_COMPARE, useCompareItems } from "@/lib/compare-selection";
import { BagIcon, CompareIcon, SparkIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

function NavItem({
  href,
  pathname,
  active,
  icon,
  label,
  count,
  countText,
  countLabel,
}: {
  href: string;
  pathname: string;
  /** Styled as the current section, e.g. Discover on a product page. */
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  /** What the badge shows, when it is not just the count. */
  countText?: string;
  countLabel?: string;
}) {
  const showCount = count !== undefined && count > 0;
  return (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : active ? "true" : undefined}
      className={`relative flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2.5 text-sm transition sm:px-3 ${
        active ? "bg-tint/8 font-medium text-fg" : "text-fg-muted hover:bg-tint/5 hover:text-fg"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {showCount && (
        // On a phone the badge sits on the icon, so every item stays 44px wide.
        <span
          aria-hidden="true"
          className="absolute -right-0.5 top-0.5 min-w-5 rounded-full bg-linear-to-r from-accent to-violet px-1 text-center text-[10px] font-bold leading-4 tabular-nums text-accent-ink sm:static sm:px-1.5 sm:text-[11px] sm:leading-5"
        >
          {countText ?? count}
        </span>
      )}
      {/* The current section is marked by a bar as well as by colour. */}
      {active && (
        <span
          aria-hidden="true"
          className="nav-current-bar absolute inset-x-2.5 -bottom-1.5 h-0.5 rounded-full bg-linear-to-r from-accent to-violet"
        />
      )}
      <span className="sr-only sm:hidden">{label}</span>
      {showCount && countLabel && <span className="sr-only">, {countLabel}</span>}
    </Link>
  );
}

/** Primary navigation. Counts come from browser storage, so they appear
 *  once the client has read it; the server renders the same links without. */
export function SiteNav() {
  const pathname = usePathname();
  const compare = useCompareItems();
  const cart = useCartItems();
  const compareCount = compare?.length;
  const cartCount = cart?.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav aria-label="Primary" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <NavItem
        href="/"
        pathname={pathname}
        active={pathname === "/" || pathname.startsWith("/product/")}
        icon={<SparkIcon size={17} />}
        label="Discover"
      />
      <NavItem
        href="/compare"
        pathname={pathname}
        active={pathname === "/compare"}
        icon={<CompareIcon size={17} />}
        label="Compare"
        count={compareCount}
        countText={compareCount ? `${compareCount}/${MAX_COMPARE}` : undefined}
        countLabel={`${compareCount} of ${MAX_COMPARE} selected`}
      />
      <NavItem
        href="/cart"
        pathname={pathname}
        active={pathname === "/cart" || pathname === "/checkout"}
        icon={<BagIcon size={17} />}
        label="Demo cart"
        count={cartCount}
        countLabel={`${cartCount} items`}
      />
      <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px bg-line-strong sm:block" />
      <ThemeToggle />
    </nav>
  );
}
