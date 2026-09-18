/** Shapes and URL encoding for the optional comparison feature.
 *
 *  Comparison is optional throughout: nothing here is required to browse, add
 *  to the cart or check out. */

import type { ComparisonGroup } from "./comparison-group";

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;

/** What the tray persists. Only identifiers — never prices or titles, which are
 *  resolved from the catalog on the server. */
export interface CompareEntry {
  slug: string;
  group: ComparisonGroup;
}

/** One column on the comparison page. `size` is empty until the shopper picks
 *  one, which is how clothing is prevented from reaching the cart without an
 *  explicit size. */
export interface CompareSelection {
  slug: string;
  colorId?: string;
  sizeId?: string;
}

const SEP = "~";

export function encodeSelection(sel: CompareSelection): string {
  return [sel.slug, sel.colorId ?? "", sel.sizeId ?? ""].join(SEP);
}

/** Parses one `p=` value. Returns undefined for anything malformed rather than
 *  throwing, so a hand-edited URL degrades instead of erroring. */
export function decodeSelection(raw: string): CompareSelection | undefined {
  if (typeof raw !== "string") return undefined;
  const parts = raw.split(SEP);
  const slug = parts[0]?.trim();
  if (!slug) return undefined;
  return {
    slug,
    colorId: parts[1]?.trim() || undefined,
    sizeId: parts[2]?.trim() || undefined,
  };
}

export function compareHref(selections: CompareSelection[]): string {
  const sp = new URLSearchParams();
  for (const sel of selections) sp.append("p", encodeSelection(sel));
  return `/compare?${sp.toString()}`;
}

/** Why an attempt to add to the comparison did not simply succeed. The tray and
 *  the toggle both need to explain these, so they are values rather than
 *  thrown errors. */
export type AddToCompareResult =
  | { status: "added" }
  | { status: "already_added" }
  | { status: "full"; max: number }
  | { status: "group_mismatch"; current: ComparisonGroup; incoming: ComparisonGroup };
