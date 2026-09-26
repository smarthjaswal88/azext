"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;

/**
 * One shortlisted product. Only the slug and category matter for behaviour;
 * title and image are copied from the live listing when it was added, purely
 * so the tray can show a thumbnail without another request. The compare page
 * always loads fresh details.
 */
export interface CompareItem {
  slug: string;
  category: string;
  title: string;
  imageUrl: string | null;
}

export type AddResult =
  | { status: "added" }
  | { status: "already_added" }
  | { status: "full" }
  | { status: "category_mismatch"; current: string };

interface CompareState {
  items: CompareItem[];
  /** Never replaces anything silently: a clash is reported for the UI to ask. */
  add: (item: CompareItem) => AddResult;
  /** Only after the shopper explicitly chooses to start over. */
  replaceWith: (item: CompareItem) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const { items } = get();
        if (items.some((i) => i.slug === item.slug)) return { status: "already_added" };
        const current = items[0]?.category;
        if (current && current !== item.category) return { status: "category_mismatch", current };
        if (items.length >= MAX_COMPARE) return { status: "full" };
        set({ items: [...items, item] });
        return { status: "added" };
      },
      replaceWith: (item) => set({ items: [item] }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
    }),
    {
      // Kept from before the rename to Vetra, so saved comparisons survive.
      name: "nexus-compare-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

/** Undefined during server rendering and hydration, then the stored items —
 *  the same approach as the cart, so server and client markup match. */
export function useCompareItems(): CompareItem[] | undefined {
  return useSyncExternalStore(
    useCompareStore.subscribe,
    () => useCompareStore.getState().items,
    () => undefined,
  );
}
