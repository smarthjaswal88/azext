"use client";

import { useState } from "react";
import { catalogCategoryLabel } from "@/lib/catalog-api";
import { MAX_COMPARE, useCompareItems, useCompareStore, type CompareItem } from "@/lib/compare-selection";
import { CheckIcon, CompareIcon } from "./icons";

/**
 * Adds a product to the comparison, or removes it. Products are compared
 * within one category; adding from another asks first, and the shopper can
 * keep what they have.
 */
export function CompareToggle({ item, block = false }: { item: CompareItem; block?: boolean }) {
  const items = useCompareItems();
  const add = useCompareStore((s) => s.add);
  const remove = useCompareStore((s) => s.remove);
  const replaceWith = useCompareStore((s) => s.replaceWith);
  const [notice, setNotice] = useState<string>();
  const [clash, setClash] = useState<string>();

  const ready = items !== undefined;
  const selected = items?.some((i) => i.slug === item.slug) ?? false;

  function toggle() {
    setNotice(undefined);
    setClash(undefined);
    if (selected) {
      remove(item.slug);
      return;
    }
    const result = add(item);
    if (result.status === "full") setNotice(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
    if (result.status === "category_mismatch") setClash(result.current);
  }

  return (
    <div className={block ? "w-full" : undefined}>
      <button
        type="button"
        onClick={toggle}
        disabled={!ready}
        aria-pressed={selected}
        className={`btn btn-sm ${block ? "btn-block" : ""} ${selected ? "btn-secondary border-accent/70 text-accent-strong" : "btn-secondary"}`}
      >
        {selected ? <CheckIcon size={15} /> : <CompareIcon size={15} />}
        {selected ? "In comparison" : "Compare"}
      </button>

      {notice && (
        <p role="status" className="mt-2 text-xs text-fg-muted">
          {notice}
        </p>
      )}

      {clash && (
        <div role="alertdialog" aria-label="Start a new comparison" className="glass-strong mt-2 p-3 text-left">
          <p className="text-xs leading-relaxed text-fg-muted">
            Your comparison holds {catalogCategoryLabel(clash).toLowerCase()}. Products are compared
            within one category, so adding this starts a new comparison.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                replaceWith(item);
                setClash(undefined);
              }}
              className="btn btn-primary btn-sm"
            >
              Start new comparison
            </button>
            <button type="button" onClick={() => setClash(undefined)} className="btn btn-ghost btn-sm">
              Keep current
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
