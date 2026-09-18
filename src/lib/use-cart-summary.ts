"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartItem, PricedCart } from "./cart";

interface Outcome {
  /** The serialised items this outcome was produced for. */
  key: string;
  data?: PricedCart;
  error?: string;
}

/** Prices a set of items on the server. The client never computes money, so
 *  even the number shown next to the button comes from the catalog.
 *
 *  `loading` is derived by comparing the items we have a result for against the
 *  items we were asked about, rather than being a separate piece of state. That
 *  keeps the effect free of synchronous setState and makes "stale" impossible
 *  to get wrong: if the result does not match the request, it is loading. */
export function useCartSummary(items: CartItem[], enabled = true) {
  const [outcome, setOutcome] = useState<Outcome | undefined>();
  const [attempt, setAttempt] = useState(0);

  const key = JSON.stringify(items);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/cart/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: JSON.parse(key) as CartItem[] }),
        });
        if (!response.ok) throw new Error(`Pricing failed (${response.status}).`);
        const data = (await response.json()) as PricedCart;
        if (!cancelled) setOutcome({ key, data });
      } catch (cause) {
        if (!cancelled) {
          setOutcome({
            key,
            error: cause instanceof Error ? cause.message : "Could not price the cart.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, enabled, attempt]);

  // Retrying is a user action, not an effect, so setting state here is fine.
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    // Stale data is kept visible while a newer request is in flight, with
    // `loading` telling the UI to say so.
    data: outcome?.data,
    error: outcome?.key === key ? outcome.error : undefined,
    loading: !enabled ? false : outcome?.key !== key,
    reload,
  };
}
