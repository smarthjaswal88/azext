/**
 * The comparison group: the set a product must share before it can be compared
 * against another.
 *
 * Deliberately finer than category. "Clothing" is not a comparable set — a
 * chino and a t-shirt share almost no specification rows, so a table of the two
 * would be mostly "Not provided" and would tell a shopper nothing. The groups
 * below are drawn so that the rows actually line up.
 *
 * Enforced in four places, because any one of them can be bypassed alone:
 *   - the selection control, which asks before replacing;
 *   - the comparison page, which will not pick a subset out of a mixed URL;
 *   - the tray summary endpoint;
 *   - the AI guidance endpoint.
 */

import type { ComparisonGroupId } from "./types";

export type ComparisonGroup = ComparisonGroupId;

export const COMPARISON_GROUP_LABELS: Record<ComparisonGroupId, string> = {
  "personal-audio": "Personal audio",
  "shirts-and-tops": "Shirts and tops",
  "knitwear-and-layers": "Knitwear and layers",
  trousers: "Trousers",
};

/** What the group holds, for messages that have to explain the rule. */
export const COMPARISON_GROUP_DESCRIPTIONS: Record<ComparisonGroupId, string> = {
  "personal-audio": "headphones and earbuds",
  "shirts-and-tops": "shirts and tees",
  "knitwear-and-layers": "sweaters and fleeces",
  trousers: "trousers",
};

export function comparisonGroupOf(product: {
  comparisonGroup: ComparisonGroupId;
}): ComparisonGroup {
  return product.comparisonGroup;
}

export function comparisonGroupLabel(group: ComparisonGroup): string {
  return COMPARISON_GROUP_LABELS[group] ?? group;
}

export function comparisonGroupDescription(group: ComparisonGroup): string {
  return COMPARISON_GROUP_DESCRIPTIONS[group] ?? "similar products";
}

/** The group a set of products shares, or undefined when they disagree.
 *  Callers decide what to do about that; none of them picks a subset. */
export function sharedComparisonGroup(
  products: { comparisonGroup: ComparisonGroupId }[],
): ComparisonGroup | undefined {
  if (products.length === 0) return undefined;
  const first = comparisonGroupOf(products[0]);
  return products.every((p) => comparisonGroupOf(p) === first) ? first : undefined;
}
