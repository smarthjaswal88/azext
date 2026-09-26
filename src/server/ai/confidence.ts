/**
 * Recommendation confidence — computed here, on the server, from fixed rules.
 * The model is told not to produce one, and its output is never consulted for
 * one.
 *
 * WHAT IT MEANS: how well the available listing evidence supports the
 * recommendation for the stated need. Not a quality score and not a promise
 * that the shopper will be satisfied.
 *
 * THE RULES (thresholds in CONFIDENCE_THRESHOLDS, src/lib/guidance.ts):
 *
 *   Low when any of these holds:
 *     - no product was recommended;
 *     - the recommended listing is thin (fewer than 3 specifications and
 *       fewer than 3 features);
 *     - the compared products are too similar to separate (same type, price
 *       within 5%, rating within 0.1);
 *     - the recommended product is above a budget stated in the need;
 *     - fewer than 1 supporting field, or fewer than 50 ratings.
 *   High when at least 3 distinct listing fields support the recommendation,
 *     it has at least 1,000 ratings, and no part of the need was reported as
 *     unaddressed by any field.
 *   Medium otherwise.
 *
 * "Supporting fields" are the distinct field references cited for the
 * recommended product that exist in its listing — each is checked against the
 * catalog before it counts. Whether a field is relevant is the assistant's
 * claim, which is why every cited value is shown beside the note that uses it.
 * The only model output that affects the level is the list of unaddressed
 * needs, and it can only lower confidence, never raise it.
 */

import { CONFIDENCE_THRESHOLDS as T, type GuidanceConfidence } from "@/lib/guidance";
import { formatCount, formatPrice } from "@/lib/format";
import type { ContextProduct, GuidanceContext } from "./context";

const LABELS = { high: "High", medium: "Medium", low: "Low" } as const;

/** Every pair shares a type and sits within the price and rating tolerances. */
export function tooSimilar(products: ContextProduct[]): boolean {
  if (products.length < 2) return false;
  for (let i = 0; i < products.length; i += 1) {
    for (let j = i + 1; j < products.length; j += 1) {
      const a = products[i];
      const b = products[j];
      if (a.productType !== b.productType) return false;
      const priceGap = Math.abs(a.priceCents - b.priceCents) / Math.max(a.priceCents, b.priceCents);
      if (priceGap > T.similarPriceRatio) return false;
      if (a.rating === null || b.rating === null || Math.abs(a.rating - b.rating) > T.similarRatingGap) return false;
    }
  }
  return true;
}

export function assessConfidence(input: {
  context: GuidanceContext;
  recommendedSlug: string | null;
  /** Validated evidence: every field here exists in its product's listing. */
  evidence: { slug: string; field: string }[];
  unaddressed: string[];
}): GuidanceConfidence {
  const { context, recommendedSlug, evidence, unaddressed } = input;
  const low = (reasons: string[]): GuidanceConfidence => ({ level: "low", label: LABELS.low, reasons });

  const product = recommendedSlug ? context.products.find((p) => p.slug === recommendedSlug) : undefined;
  if (!product) {
    return low(["No product was recommended for this need, so there is nothing to be confident about."]);
  }

  const fields = new Set(evidence.filter((e) => e.slug === product.slug).map((e) => e.field));
  const ratings = product.ratingCount ?? 0;
  const reasons: string[] = [
    `${fields.size} distinct listing field${fields.size === 1 ? "" : "s"} cited in support (High needs ${T.highMinFields}).`,
    `${formatCount(ratings)} ratings on the recommended product (High needs ${formatCount(T.highMinRatings)}, Medium ${formatCount(T.mediumMinRatings)}).`,
  ];

  if (product.specifications.length < T.minDetails && product.features.length < T.minDetails) {
    return low([
      ...reasons,
      `The listing is thin: ${product.specifications.length} specifications and ${product.features.length} features.`,
    ]);
  }
  if (tooSimilar(context.products)) {
    return low([
      ...reasons,
      "The compared products are too similar to separate: same type, prices within 5% and ratings within 0.1.",
    ]);
  }
  if (context.budgetCents !== undefined && product.priceCents > context.budgetCents) {
    return low([...reasons, `The recommended product is above the stated budget of ${formatPrice(context.budgetCents)}.`]);
  }
  if (fields.size < T.mediumMinFields || ratings < T.mediumMinRatings) {
    return low(reasons);
  }

  if (unaddressed.length > 0) {
    reasons.push(
      `${unaddressed.length} part${unaddressed.length === 1 ? "" : "s"} of the need ${
        unaddressed.length === 1 ? "is" : "are"
      } not covered by any listing field, which rules out High.`,
    );
  }

  const high = fields.size >= T.highMinFields && ratings >= T.highMinRatings && unaddressed.length === 0;
  return { level: high ? "high" : "medium", label: high ? LABELS.high : LABELS.medium, reasons };
}
