/**
 * Review confidence — computed here, on the server, and never by the model.
 *
 * WHAT IT MEANS: how much the *available review evidence* supports any
 * conclusion about this product. It is not a quality score, not a prediction
 * that a shopper will be satisfied, and not a recommendation. A well-liked
 * product with two reviews scores lower than a divisive one with fifty.
 *
 * WHY IT IS NOT THE MODEL'S JOB: a language model asked to rate its own
 * evidence will produce a plausible-sounding label rather than a measured one,
 * and it has every incentive to sound confident. The rules below are
 * deterministic, so the same evidence always yields the same label and the
 * reasoning can be shown to the shopper.
 *
 * THE RULES, in order:
 *
 *   texts analysed  0 or 1              -> Insufficient evidence
 *   texts analysed  2 to 3              -> Low
 *   texts analysed  4 to 7              -> Medium
 *   texts analysed  8 or more           -> High
 *
 *   then, one downgrade (never below Low) if the ratings strongly disagree,
 *   meaning the spread between the highest and lowest analysed rating is 3 or
 *   more stars. Sharply split opinion means the evidence supports less.
 *
 * A NOTE ON THIS DEMO CATALOG: it holds at most four written review records
 * per product, so "High" is unreachable here. That is deliberate and correct —
 * four texts are not strong evidence, whatever the aggregate rating count in
 * the demo data says.
 */

import type { Review } from "@/lib/types";

export type ConfidenceLevel = "insufficient" | "low" | "medium" | "high";

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  label: string;
  /** Plain-language reason, shown to the shopper. */
  reason: string;
  /** How many review texts the assessment (and the model) actually saw. */
  analysedCount: number;
  ratingSpread: number;
  downgraded: boolean;
}

const LABELS: Record<ConfidenceLevel, string> = {
  insufficient: "Insufficient evidence",
  low: "Low",
  medium: "Medium",
  high: "High",
};

const ORDER: ConfidenceLevel[] = ["insufficient", "low", "medium", "high"];

function downgrade(level: ConfidenceLevel): ConfidenceLevel {
  const i = ORDER.indexOf(level);
  // Never drops below Low: disagreement is itself a finding, not an absence.
  return ORDER[Math.max(1, i - 1)];
}

export function assessReviewConfidence(analysed: Review[]): ConfidenceAssessment {
  const n = analysed.length;
  const ratings = analysed.map((r) => r.rating);
  const spread = n > 0 ? Math.max(...ratings) - Math.min(...ratings) : 0;

  let level: ConfidenceLevel;
  if (n <= 1) level = "insufficient";
  else if (n <= 3) level = "low";
  else if (n <= 7) level = "medium";
  else level = "high";

  const conflicted = n >= 2 && spread >= 3;
  const finalLevel = conflicted ? downgrade(level) : level;

  let reason: string;
  if (n === 0) {
    reason = "No review texts were available to analyse.";
  } else if (n === 1) {
    reason = "Only one review text was available, which cannot show a pattern.";
  } else if (conflicted) {
    reason = `${n} review texts were analysed and they disagree sharply, from ${Math.min(
      ...ratings,
    )} to ${Math.max(...ratings)} stars.`;
  } else {
    reason = `${n} review text${n === 1 ? " was" : "s were"} analysed.`;
  }

  return {
    level: finalLevel,
    label: LABELS[finalLevel],
    reason,
    analysedCount: n,
    ratingSpread: spread,
    downgraded: conflicted && finalLevel !== level,
  };
}
