"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAX_COMPARE, MIN_COMPARE, useCompareItems, useCompareStore } from "@/lib/compare-selection";
import { ArrowRightIcon, CloseIcon } from "./icons";
import { RemoteImage } from "./remote-image";

/** Pages where the tray would duplicate the page or sit over order controls. */
const HIDDEN_ON = ["/compare", "/cart", "/checkout"];

/**
 * A floating shortlist, shown while browsing once something is selected. A
 * spacer keeps it from covering the end of the page.
 *
 * The thumbnails and the actions share a row while they fit; on a narrow
 * phone with three products the actions wrap onto a second row rather than
 * sliding under the thumbnails. On the discovery page from 1024px, where the
 * filter sidebar is shown, the tray sits over the results column only.
 */
export function CompareTray() {
  const pathname = usePathname();
  const items = useCompareItems();
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);

  if (!items || items.length === 0) return null;
  if (HIDDEN_ON.includes(pathname) || pathname.startsWith("/order/")) return null;
  const ready = items.length >= MIN_COMPARE;
  // The results column: container edge + padding (2rem) + sidebar (18rem) + gap (2rem).
  const beside = pathname === "/";

  return (
    <>
      <div aria-hidden="true" className="h-36 sm:h-28" />
      <section
        aria-label="Comparison shortlist"
        className={`fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl sm:inset-x-6 ${
          beside
            ? "lg:right-[calc(max(0px,(100%-80rem)/2)+2rem)] lg:left-[calc(max(0px,(100%-80rem)/2)+22rem)]"
            : ""
        }`}
      >
        <div className="glass-strong glow flex flex-wrap items-center gap-x-4 gap-y-2.5 p-2.5 pl-3">
          <ul className="flex flex-auto items-center gap-2.5">
            {items.map((item) => (
              <li key={item.slug} className="relative shrink-0">
                <RemoteImage src={item.imageUrl} alt={item.title} sizes="48px" className="size-12" padding="p-1" />
                <button
                  type="button"
                  onClick={() => remove(item.slug)}
                  className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-line-strong bg-graphite-800 text-fg-muted after:absolute after:-inset-1.5 after:content-[''] hover:text-fg"
                >
                  <CloseIcon size={11} />
                  <span className="sr-only">Remove {item.title} from comparison</span>
                </button>
              </li>
            ))}
            {Array.from({ length: MAX_COMPARE - items.length }).map((_, i) => (
              <li
                key={`slot-${i}`}
                aria-hidden="true"
                className="hidden size-12 shrink-0 rounded-2xl border border-dashed border-line-strong sm:block"
              />
            ))}
          </ul>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={clear} className="btn btn-ghost btn-sm max-sm:min-h-11">
              Clear
              <span className="sr-only"> comparison</span>
            </button>
            {ready ? (
              <Link href="/compare" className="btn btn-primary btn-sm max-sm:min-h-11">
                Compare {items.length}
                <ArrowRightIcon size={15} />
              </Link>
            ) : (
              <span className="px-2 text-xs text-fg-muted">Add one more to compare</span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
