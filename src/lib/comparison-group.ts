/**
 * The comparison group: the set a product must share before it can be compared
 * against another.
 *
 * Today one group per category, because that is what makes the table mean
 * anything — a sweater and a pair of headphones share no specification rows to
 * align, so a column-by-column comparison of them is noise. It is named and
 * typed separately from `CategoryId` so the rule has one definition and one
 * place to change if grouping ever stops tracking category.
 *
 * Enforced in four places, deliberately, because any one of them can be
 * bypassed on its own:
 *   - the selection control, which asks before replacing;
 *   - the comparison page, which drops mismatches out of a hand-edited URL;
 *   - the tray summary endpoint;
 *   - the AI guidance endpoint.
 */

import type { CategoryId } from "./types";

export type ComparisonGroup = CategoryId;

export const COMPARISON_GROUP_LABELS: Record<ComparisonGroup, string> = {
  headphones: "Headphones",
  clothing: "Clothing",
};

export function comparisonGroupOf(product: { category: CategoryId }): ComparisonGroup {
  return product.category;
}

export function comparisonGroupLabel(group: ComparisonGroup): string {
  return COMPARISON_GROUP_LABELS[group] ?? group;
}

/** The group a set of products belongs to, or undefined when they disagree.
 *  Callers decide whether that is a refusal or something to trim. */
export function sharedComparisonGroup(
  products: { category: CategoryId }[],
): ComparisonGroup | undefined {
  if (products.length === 0) return undefined;
  const first = comparisonGroupOf(products[0]);
  return products.every((p) => comparisonGroupOf(p) === first) ? first : undefined;
}
