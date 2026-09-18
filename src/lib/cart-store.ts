"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { clampQuantity, type CartItem } from "./cart";

interface CartState {
  items: CartItem[];
  addItem: (variantId: string, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  /** Used after an order is placed to drop exactly what was bought. */
  removeItems: (variantIds: string[]) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (variantId, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === variantId);
          // Repeated additions of the same variant merge into one line rather
          // than stacking duplicates.
          const next = clampQuantity((existing?.quantity ?? 0) + quantity).quantity;
          return existing
            ? {
                items: state.items.map((i) =>
                  i.variantId === variantId ? { ...i, quantity: next } : i,
                ),
              }
            : { items: [...state.items, { variantId, quantity: next }] };
        }),

      setQuantity: (variantId, quantity) =>
        set((state) => {
          if (quantity < 1) {
            return { items: state.items.filter((i) => i.variantId !== variantId) };
          }
          const { quantity: safe } = clampQuantity(quantity);
          return {
            items: state.items.map((i) =>
              i.variantId === variantId ? { ...i, quantity: safe } : i,
            ),
          };
        }),

      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      removeItems: (variantIds) =>
        set((state) => {
          const drop = new Set(variantIds);
          return { items: state.items.filter((i) => !drop.has(i.variantId)) };
        }),

      clear: () => set({ items: [] }),
    }),
    {
      name: "shop-demo-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

/**
 * Reads the cart in a way that is safe to render on the server.
 *
 * Returns `undefined` during server rendering and during the hydration pass,
 * then the real items once React switches to the client snapshot. That is what
 * keeps the header from flashing an empty cart at a returning shopper, and what
 * keeps the server and client markup identical while hydrating — the reason
 * this uses useSyncExternalStore rather than a "hydrated" flag in the store.
 * A flag set from persist's rehydrate callback cannot work here: with
 * synchronous storage that callback runs while the store is still being
 * created.
 */
export function useCartItems(): CartItem[] | undefined {
  return useSyncExternalStore(
    useCartStore.subscribe,
    () => useCartStore.getState().items,
    () => undefined,
  );
}
