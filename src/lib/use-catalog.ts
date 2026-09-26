"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogCategoriesResponse, CatalogProductDetail } from "./catalog-api";
import {
  CatalogRequestError,
  fetchAllProducts,
  fetchCategories,
  fetchProduct,
  isAbort,
  type ProductCollection,
  type ProductQueryParams,
} from "./catalog-client";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: CatalogRequestError }
  | { status: "ready"; data: T };

interface Outcome<T> {
  key: string;
  data?: T;
  error?: CatalogRequestError;
}

function toCatalogError(cause: unknown): CatalogRequestError {
  return cause instanceof CatalogRequestError
    ? cause
    : new CatalogRequestError(0, "unexpected", "Something went wrong while loading the catalog.");
}

/**
 * Loads `key` with `load` and keeps only the newest result. Loading is
 * derived — the result on hand is for a different key — rather than set
 * inside the effect, so a slow earlier response can never overwrite a newer
 * one and there is no synchronous state update in the effect.
 *
 * `load` must be a stable, module-level function.
 */
function useKeyedLoad<T>(
  key: string,
  load: (key: string, signal: AbortSignal) => Promise<T>,
): { state: AsyncState<T>; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome<T>>();
  const fullKey = `${attempt}:${key}`;

  useEffect(() => {
    const controller = new AbortController();
    load(key, controller.signal).then(
      (data) => setOutcome({ key: fullKey, data }),
      (cause) => {
        if (isAbort(cause)) return;
        setOutcome({ key: fullKey, error: toCatalogError(cause) });
      },
    );
    return () => controller.abort();
  }, [fullKey, key, load]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  let state: AsyncState<T>;
  if (!outcome || outcome.key !== fullKey) state = { status: "loading" };
  else if (outcome.error) state = { status: "error", error: outcome.error };
  else state = { status: "ready", data: outcome.data as T };

  return { state, retry };
}

const loadCategories = (_key: string, signal: AbortSignal) => fetchCategories(signal);

export function useCatalogCategories() {
  return useKeyedLoad<CatalogCategoriesResponse>("categories", loadCategories);
}

const loadProducts = (key: string, signal: AbortSignal) =>
  fetchAllProducts(JSON.parse(key) as ProductQueryParams, signal);

export function useCatalogProducts(params: Omit<ProductQueryParams, "limit" | "offset">) {
  return useKeyedLoad<ProductCollection>(JSON.stringify(params), loadProducts);
}

const loadProduct = (slug: string, signal: AbortSignal) => fetchProduct(slug, signal);

export function useCatalogProduct(slug: string) {
  return useKeyedLoad<CatalogProductDetail>(slug, loadProduct);
}

const loadProductSet = (key: string, signal: AbortSignal) =>
  Promise.all((JSON.parse(key) as string[]).map((slug) => fetchProduct(slug, signal)));

/** Several products at once, in the order given. */
export function useCatalogProductSet(slugs: string[]) {
  return useKeyedLoad<CatalogProductDetail[]>(JSON.stringify(slugs), loadProductSet);
}
