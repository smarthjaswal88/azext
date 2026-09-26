import type { KeyboardEvent } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab and Shift+Tab cycling inside a modal dialog. A native modal
 * <dialog> already makes the page behind inert, but lets Tab leave the last
 * control for the browser's own UI; this wraps it back to the first. Use as
 * the dialog's onKeyDown.
 */
export function keepTabInside(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
