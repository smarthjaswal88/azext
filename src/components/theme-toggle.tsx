"use client";

import { useState, useSyncExternalStore } from "react";
import { THEME_EVENT, applyTheme, currentTheme, type Theme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./icons";

function subscribe(onChange: () => void) {
  document.addEventListener(THEME_EVENT, onChange);
  return () => document.removeEventListener(THEME_EVENT, onChange);
}

/**
 * Switches between the light and dark themes and saves the choice. The icon
 * shows the theme it switches to, the accessible name says so, and a live
 * region announces the theme once it changes. (ThemeSync, in the root
 * layout, applies a choice made in another tab.)
 */
export function ThemeToggle() {
  // undefined on the server and during hydration: the inline script has set
  // the real theme on <html>, which the first client render then reads.
  const theme = useSyncExternalStore<Theme | undefined>(subscribe, currentTheme, () => undefined);
  const [announcement, setAnnouncement] = useState("");

  const next: Theme = theme === "light" ? "dark" : "light";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          applyTheme(next, { save: true });
          setAnnouncement(`${next === "light" ? "Light" : "Dark"} theme on`);
        }}
        aria-label={theme ? `Switch to ${next} theme` : "Switch theme"}
        title={theme ? `Switch to ${next} theme` : undefined}
        className="flex size-11 items-center justify-center rounded-xl text-fg-muted transition hover:bg-tint/5 hover:text-fg"
      >
        {/* Both icons render; the stylesheet shows the right one from the
            first paint, before this component has hydrated. */}
        <SunIcon size={18} className="theme-icon-sun" />
        <MoonIcon size={17} className="theme-icon-moon" />
      </button>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
