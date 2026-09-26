"use client";

import { useLayoutEffect } from "react";
import { THEME_STORAGE_KEY, applyTheme, currentTheme, initialTheme } from "@/lib/theme";

/**
 * Keeps <html data-theme> right on every page, in the root layout.
 *
 * The inline script in <head> sets it before the first paint. When React
 * has to render the document itself — as it does for some error and
 * not-found responses — the new <html> arrives without it; this restores it
 * before the browser paints. It also picks up a choice made in another tab.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    if (!currentTheme()) applyTheme(initialTheme(), { save: false });

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(initialTheme(), { save: false });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}
