"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { compareHref, MAX_COMPARE, MIN_COMPARE } from "@/lib/compare";
import { useCompareEntries, useCompareStore } from "@/lib/compare-store";
import { CloseIcon } from "./icons";

interface MiniProduct {
  slug: string;
  title: string;
  brand: string;
  imageSrc: string;
  imageAlt: string;
}

// The tray only ever holds one group, because the selection control enforces
// that before anything reaches here.

/**
 * Appears once something is selected and persists across navigation and
 * refresh, because the selection lives in the store rather than in the page.
 *
 * On small screens it is a fixed bar, so a spacer of the same height is left in
 * the flow — without it the bar would sit over the last controls on the page,
 * which on a product page is the buy box.
 */
export function CompareTray() {
  const pathname = usePathname();
  const entries = useCompareEntries();
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);

  const [products, setProducts] = useState<MiniProduct[]>([]);
  const slugs = (entries ?? []).map((e) => e.slug);
  const key = slugs.join(",");

  useEffect(() => {
    if (!key) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/compare/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slugs: key.split(",") }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { items: MiniProduct[] };
        if (!cancelled) setProducts(data.items);
      } catch {
        // The tray is an aid, not a requirement. If this fails the shopper can
        // still reach the comparison page from the button below.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Hidden on the comparison page itself, where it would duplicate the columns.
  if (!entries || entries.length === 0 || pathname === "/compare") return null;

  const ordered = slugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is MiniProduct => p !== undefined);
  const canCompare = entries.length >= MIN_COMPARE;

  return (
    <>
      {/* Keeps the fixed bar from covering the end of the page. */}
      <div aria-hidden="true" className="h-[104px] sm:h-[96px]" />

      <section
        aria-label="Product comparison"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-surface shadow-[0_-2px_12px_rgba(15,17,17,0.12)]"
      >
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {Array.from({ length: MAX_COMPARE }).map((_, i) => {
              const product = ordered[i];
              if (!product) {
                return (
                  <div
                    key={`empty-${i}`}
                    aria-hidden="true"
                    className="hidden size-14 shrink-0 rounded border border-dashed border-border-subtle sm:block"
                  />
                );
              }
              return (
                <div
                  key={product.slug}
                  className="relative size-14 shrink-0 rounded border border-border-subtle bg-surface-image"
                >
                  <Image
                    src={product.imageSrc}
                    alt={product.imageAlt}
                    fill
                    sizes="56px"
                    className="object-contain p-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => remove(product.slug)}
                    aria-label={`Remove ${product.title} from comparison`}
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-border-strong bg-surface p-0.5 text-ink-muted hover:text-ink"
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <p className="text-xs text-ink-muted">
              {entries.length} of {MAX_COMPARE} selected
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
              >
                Clear
              </button>
              {canCompare ? (
                <Link
                  href={compareHref(slugs.map((slug) => ({ slug })))}
                  className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
                >
                  Compare
                </Link>
              ) : (
                <span
                  className="cursor-not-allowed rounded-full bg-surface-muted px-4 py-1.5 text-sm font-semibold text-ink-muted"
                  title={`Select at least ${MIN_COMPARE} products`}
                >
                  Compare
                </span>
              )}
            </div>
          </div>
        </div>
        {!canCompare && (
          <p className="px-3 pb-2 text-center text-[11px] text-ink-muted sm:px-4">
            Add one more product to compare.
          </p>
        )}
      </section>
    </>
  );
}
