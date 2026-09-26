"use client";

import { useEffect, useId, useRef, useState } from "react";
import { catalogCategoryLabel } from "@/lib/catalog-api";
import { keepTabInside } from "@/lib/focus-trap";
import { MAX_COMPARE, useCompareItems, useCompareStore, type CompareItem } from "@/lib/compare-selection";
import { CheckIcon, CompareIcon } from "./icons";

/**
 * Adds a product to the comparison, or removes it. Products are compared
 * within one category; adding from another asks first, in a modal dialog, and
 * the shopper can keep what they have.
 *
 * The visible label stays "Compare" and aria-pressed carries the state; the
 * accessible name adds the product, so a list of controls tells them apart.
 *
 * `floating` shows the "list is full" notice over the content above the
 * control rather than below it, so a product card keeps its height; the
 * nearest positioned ancestor sets its width.
 */
export function CompareToggle({
  item,
  block = false,
  floating = false,
  className,
  buttonClassName = "",
}: {
  item: CompareItem;
  block?: boolean;
  floating?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const items = useCompareItems();
  const add = useCompareStore((s) => s.add);
  const remove = useCompareStore((s) => s.remove);
  const replaceWith = useCompareStore((s) => s.replaceWith);
  const [notice, setNotice] = useState("");
  const [clash, setClash] = useState<string>();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  const ready = items !== undefined;
  const selected = items?.some((i) => i.slug === item.slug) ?? false;

  // The dialog is modal: the page behind is inert, Tab stays inside, Escape
  // cancels, and only one can be open. Focus returns to the toggle.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (clash && !dialog.open) {
      dialog.showModal();
      confirmRef.current?.focus();
    }
    if (!clash && dialog.open) dialog.close();
  }, [clash]);

  function toggle() {
    setNotice("");
    setClash(undefined);
    if (selected) {
      remove(item.slug);
      return;
    }
    const result = add(item);
    if (result.status === "full") setNotice(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
    if (result.status === "category_mismatch") setClash(result.current);
  }

  function closeClash() {
    setClash(undefined);
    toggleRef.current?.focus();
  }

  return (
    <div className={className ?? (block ? "w-full" : undefined)}>
      <button
        ref={toggleRef}
        type="button"
        onClick={toggle}
        disabled={!ready}
        aria-pressed={selected}
        className={`btn btn-sm ${block || floating ? "btn-block" : ""} ${selected ? "btn-secondary border-accent/70 bg-accent/12 text-accent-strong" : "btn-secondary"} ${buttonClassName}`}
      >
        {selected ? <CheckIcon size={15} /> : <CompareIcon size={15} />}
        Compare
        <span className="sr-only"> {item.title}</span>
      </button>

      {/* Always present, so the notice is announced when its text changes. */}
      <p role="status" className="sr-only">
        {notice}
      </p>
      {notice && (
        <p
          aria-hidden="true"
          className={`text-xs text-fg-muted ${
            floating
              ? "glass-strong absolute inset-x-2 bottom-2 z-20 bg-none bg-graphite-850 px-3 py-2.5 sm:inset-x-0 sm:bottom-full sm:mb-2"
              : "mt-2"
          }`}
        >
          {notice}
        </p>
      )}

      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={keepTabInside}
        onClose={() => {
          if (clash) closeClash();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeClash();
        }}
        className="glass-strong m-auto w-[min(26rem,calc(100%-2rem))] bg-none bg-graphite-850 p-5 text-left text-fg shadow-2xl shadow-black/60 backdrop:bg-void/70 backdrop:backdrop-blur-sm"
      >
        {clash && (
          <>
            <h2 id={titleId} className="text-base font-semibold text-fg">
              Start a new comparison?
            </h2>
            <p id={messageId} className="mt-2 text-sm leading-relaxed text-fg-muted">
              Your comparison holds {catalogCategoryLabel(clash).toLowerCase()}. Products are compared
              within one category, so adding {item.title} starts a new comparison.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={closeClash} className="btn btn-ghost">
                Keep current
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => {
                  replaceWith(item);
                  closeClash();
                }}
                className="btn btn-primary"
              >
                Start new comparison
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
