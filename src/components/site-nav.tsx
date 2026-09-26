"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCartItems } from "@/lib/cart-store";
import { useCompareItems } from "@/lib/compare-selection";
import { BagIcon, CompareIcon, SparkIcon } from "./icons";

function NavItem({
  href,
  active,
  icon,
  label,
  count,
  countLabel,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  countLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
        active ? "bg-white/8 text-fg" : "text-fg-muted hover:bg-white/5 hover:text-fg"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          aria-hidden="true"
          className="min-w-5 rounded-full bg-linear-to-r from-accent to-violet px-1.5 text-center text-[11px] font-bold leading-5 text-accent-ink"
        >
          {count}
        </span>
      )}
      <span className="sr-only sm:hidden">{label}</span>
      {count !== undefined && count > 0 && countLabel && <span className="sr-only">, {countLabel}</span>}
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
    <nav aria-label="Primary" className="flex items-center gap-1">
      <NavItem href="/" active={pathname === "/"} icon={<SparkIcon size={17} />} label="Discover" />
      <NavItem
        href="/compare"
        active={pathname === "/compare"}
        icon={<CompareIcon size={17} />}
        label="Compare"
        count={compareCount}
        countLabel={`${compareCount} selected`}
      />
      <NavItem
        href="/cart"
        active={pathname === "/cart" || pathname === "/checkout"}
        icon={<BagIcon size={17} />}
        label="Demo cart"
        count={cartCount}
        countLabel={`${cartCount} items`}
      />
    </nav>
  );
}
