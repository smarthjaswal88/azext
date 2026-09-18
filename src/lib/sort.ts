import type { SortKey } from "./types";

/** Shared between the server page (which validates ?sort=) and the client
 *  select. It lives here rather than in the client component because a value
 *  exported from a "use client" module becomes a client reference on the
 *  server, not the array itself. */
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Most rated" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "rating-desc", label: "Average rating" },
];
