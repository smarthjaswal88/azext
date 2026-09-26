"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { keepTabInside } from "@/lib/focus-trap";
import { CloseIcon } from "../icons";

/**
 * The mobile filter sheet: a modal <dialog>, so focus stays inside, Escape
 * closes it and the page behind is inert. A tap on the backdrop closes it
 * too, and Tab cycles within it. It closes itself if the window widens to
 * the desktop layout, where the sidebar takes over.
 *
 * Because the page behind is inert while it is open, the sheet carries its
 * own live region (`status`) for the result count.
 */
export function FilterSheet({
  open,
  onClose,
  status,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  status: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The page behind should not scroll under a finger dragging the sheet.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open, onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="sheet"
      onKeyDown={keepTabInside}
      onClose={onClose}
      onClick={(event) => {
        // Only the backdrop reports the dialog itself as the target.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line py-2 pl-5 pr-2">
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-tint/15" />
        <h2 id={titleId} className="pt-2 text-base font-semibold text-fg">
          Filters
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-xl text-fg-muted transition hover:bg-tint/8 hover:text-fg"
        >
          <CloseIcon size={18} />
          <span className="sr-only">Close filters</span>
        </button>
      </div>
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
      <div className="border-t border-line px-5 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3">
        <p role="status" className="sr-only">
          {status}
        </p>
        {footer}
      </div>
    </dialog>
  );
}
