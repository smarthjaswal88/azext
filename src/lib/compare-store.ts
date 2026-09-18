"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_COMPARE, type AddToCompareResult, type CompareEntry } from "./compare";
import type { CategoryId } from "./types";

interface CompareState {
  entries: CompareEntry[];
  /** Attempts to add. Never silently drops or replaces anything — a category
   *  clash is reported so the UI can ask, and the shopper answers. */
  add: (slug: string, category: CategoryId) => AddToCompareResult;
  /** Used only after the shopper explicitly agrees to switch category. */
  replaceWith: (slug: string, category: CategoryId) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      entries: [],

      add: (slug, category) => {
        const { entries } = get();
        if (entries.some((e) => e.slug === slug)) return { status: "already_added" };

        const current = entries[0]?.category;
        if (current && current !== category) {
          return { status: "category_mismatch", current, incoming: category };
        }
        if (entries.length >= MAX_COMPARE) return { status: "full", max: MAX_COMPARE };

        set({ entries: [...entries, { slug, category }] });
        return { status: "added" };
      },

      replaceWith: (slug, category) => set({ entries: [{ slug, category }] }),

      remove: (slug) => set((s) => ({ entries: s.entries.filter((e) => e.slug !== slug) })),

      clear: () => set({ entries: [] }),
    }),
    {
      name: "shop-demo-compare-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);

/**
 * Server-safe read. Returns undefined during server rendering and hydration,
 * then the stored entries — the same approach the cart uses, and for the same
 * reason: a flag set from persist's rehydrate callback runs while the store is
 * still being created and never flips.
 */
export function useCompareEntries(): CompareEntry[] | undefined {
  return useSyncExternalStore(
    useCompareStore.subscribe,
    () => useCompareStore.getState().entries,
    () => undefined,
  );
}
