"use client";

import { useState } from "react";
import { useCompareEntries, useCompareStore } from "@/lib/compare-store";
import { MAX_COMPARE } from "@/lib/compare";
import {
  comparisonGroupDescription,
  comparisonGroupLabel,
  type ComparisonGroup,
} from "@/lib/comparison-group";
import { CheckIcon, CompareIcon } from "./icons";

/**
 * "Add to compare" for a product card or a product page.
 *
 * Kept deliberately separate from the product link and from the purchase
 * buttons: it is a checkbox-like control, not a way to buy or to navigate, and
 * on cards it is rendered outside the anchor so it is not a nested interactive
 * element.
 *
 * A comparison-group clash is never resolved silently. The shopper is asked and
 * can decline — clearing three considered choices because someone clicked the
 * wrong thing would be worse than an extra click.
 */
export function CompareToggle({
  slug,
  group,
  groupSize,
  variant = "card",
}: {
  slug: string;
  group: ComparisonGroup;
  /** How many products exist in this group, including this one. */
  groupSize: number;
  variant?: "card" | "detail";
}) {
  const entries = useCompareEntries();
  const add = useCompareStore((s) => s.add);
  const remove = useCompareStore((s) => s.remove);
  const replaceWith = useCompareStore((s) => s.replaceWith);

  const [message, setMessage] = useState<string | undefined>();
  const [clash, setClash] = useState<{ current: ComparisonGroup } | undefined>();

  const ready = entries !== undefined;
  const selected = entries?.some((e) => e.slug === slug) ?? false;
  // Comparison needs two columns. A group holding only this product can never
  // get there, so say so instead of offering a control that leads nowhere.
  const alone = groupSize < 2;

  function onToggle() {
    setMessage(undefined);
    setClash(undefined);

    if (selected) {
      remove(slug);
      return;
    }
    const result = add(slug, group);
    if (result.status === "full") {
      setMessage(`You can compare ${MAX_COMPARE} products at once. Remove one to add another.`);
    } else if (result.status === "group_mismatch") {
      setClash({ current: result.current });
    }
  }

  const isDetail = variant === "detail";

  if (alone) {
    return (
      <p
        className={`${isDetail ? "mt-3" : "mt-2"} rounded-md border border-border-subtle bg-surface-muted px-2 py-1.5 text-xs leading-snug text-ink-muted`}
      >
        Nothing to compare this with yet — {comparisonGroupDescription(group)} are only compared
        against each other, and this is the only one in the catalog.
      </p>
    );
  }

  return (
    <div className={isDetail ? "mt-3" : "mt-2"}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!ready}
        aria-pressed={selected}
        className={
          isDetail
            ? `flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                selected
                  ? "border-accent-ring bg-surface-muted"
                  : "border-border-strong bg-surface hover:bg-surface-muted"
              }`
            : `flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition disabled:opacity-60 ${
                selected
                  ? "border-accent-ring bg-surface-muted"
                  : "border-border-subtle bg-surface text-ink-muted hover:border-border-strong hover:text-ink"
              }`
        }
      >
        {selected ? <CheckIcon size={isDetail ? 16 : 13} /> : <CompareIcon size={isDetail ? 17 : 13} />}
        {selected ? "In comparison" : "Add to compare"}
      </button>

      {message && (
        <p role="status" className="mt-1.5 text-xs text-ink-muted">
          {message}
        </p>
      )}

      {clash && (
        <div
          role="alertdialog"
          aria-label="Switch comparison group"
          className="mt-2 rounded-md border border-border-strong bg-surface-muted p-2.5"
        >
          <p className="text-xs leading-snug">
            Your comparison currently holds {comparisonGroupDescription(clash.current)}. Products
            are only compared within one group, so adding this means starting again.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                replaceWith(slug, group);
                setClash(undefined);
              }}
              className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
            >
              Compare {comparisonGroupDescription(group)} instead
            </button>
            <button
              type="button"
              onClick={() => setClash(undefined)}
              className="rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-muted"
            >
              Keep my {comparisonGroupLabel(clash.current).toLowerCase()} selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
