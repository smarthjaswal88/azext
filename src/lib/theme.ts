/**
 * Light and dark themes. The theme is the `data-theme` attribute on <html>,
 * which the stylesheet turns into the root's color-scheme; every colour
 * token follows it.
 *
 * A first visit is always light, whatever the operating system prefers. The
 * toggle offers dark; a choice made there is saved, wins on later visits,
 * and is picked up by other open tabs.
 *
 * THEME_SCRIPT runs inline in <head>, before the first paint, so a page
 * never flashes the wrong theme. It must stay small, synchronous and
 * dependency-free, and it mirrors initialTheme() below.
 */

export type Theme = "light" | "dark";

/** Kept from before the rename to Vetra, so saved choices survive. */
export const THEME_STORAGE_KEY = "nexus-theme";

/** Fired on the document after the theme changes. */
export const THEME_EVENT = "vetra-themechange";

/** The theme of a first visit. */
export const DEFAULT_THEME: Theme = "light";

export const THEME_SCRIPT = `(function(){try{var t=null;try{t=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"${DEFAULT_THEME}")}catch(e){}})()`;

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function savedTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The saved choice, or light. */
export function initialTheme(): Theme {
  return savedTheme() ?? DEFAULT_THEME;
}

export function currentTheme(): Theme | undefined {
  const value = document.documentElement.getAttribute("data-theme");
  return isTheme(value) ? value : undefined;
}

/** Applies a theme; `save` records it as the shopper's choice. */
export function applyTheme(theme: Theme, { save }: { save: boolean }) {
  document.documentElement.setAttribute("data-theme", theme);
  if (save) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private mode or storage disabled: the choice lasts for this page.
    }
  }
  document.dispatchEvent(new CustomEvent(THEME_EVENT));
}
