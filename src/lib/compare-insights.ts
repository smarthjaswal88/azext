/**
 * Deterministic comparison analysis over live catalog products.
 *
 * Everything here is computed from the listing data on screen — prices,
 * ratings, rating counts, availability, options and specifications. Nothing
 * is estimated, scored by a model, or invented, and every output says what it
 * was computed from, so the UI can show its working.
 */

import type { CatalogAvailability, CatalogProductDetail, CatalogVariant } from "./catalog-api";
import { catalogProductTypeLabel } from "./catalog-api";
import { formatCount, formatPrice } from "./format";

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

/** Options that can actually be selected: a USD price and not out of stock. */
export function purchasableVariants(product: Pick<CatalogProductDetail, "variants">): CatalogVariant[] {
  return product.variants.filter(
    (v) => v.priceCents !== null && v.currency === "USD" && v.availability !== "out_of_stock",
  );
}

export function discountPercent(product: { priceCents: number; listPriceCents: number | null }): number | null {
  if (product.listPriceCents === null || product.listPriceCents <= product.priceCents) return null;
  return Math.round(((product.listPriceCents - product.priceCents) / product.listPriceCents) * 100);
}

export const AVAILABILITY_LABELS: Record<CatalogAvailability, string> = {
  in_stock: "In stock",
  limited_stock: "Limited stock",
  out_of_stock: "Out of stock",
  unknown: "Availability unknown",
};

/** The first few words of the title, for tight spaces. Not the brand alone:
 *  two products in one comparison can share a brand. */
export function shortName(product: Pick<CatalogProductDetail, "brand" | "title">): string {
  const words = product.title.split(/\s+/);
  const lead = words.slice(0, 4).join(" ");
  return lead.length < product.title.length ? `${lead}…` : lead;
}

// ---------------------------------------------------------------------------
// insight summary
// ---------------------------------------------------------------------------

export interface Insight {
  key: "lowest_price" | "top_rated" | "most_rated" | "largest_markdown" | "most_options";
  label: string;
  /** The product or products sharing the best value; more than one is a tie. */
  slugs: string[];
  /** The fact behind the insight, stated plainly. */
  detail: string;
}

/**
 * The items sharing the best score. Undefined when fewer than two items can
 * be scored, or when every scored item ties — a value everyone shares is not
 * a finding.
 */
function bestOf<T>(items: T[], score: (item: T) => number | null): { winners: T[]; best: number } | undefined {
  const scored = items
    .map((item) => ({ item, value: score(item) }))
    .filter((entry): entry is { item: T; value: number } => entry.value !== null);
  if (scored.length < 2) return undefined;
  const best = Math.max(...scored.map((s) => s.value));
  const winners = scored.filter((s) => s.value === best).map((s) => s.item);
  return winners.length === scored.length ? undefined : { winners, best };
}

export function buildInsights(products: CatalogProductDetail[]): Insight[] {
  const insights: Insight[] = [];
  const slugs = (list: CatalogProductDetail[]) => list.map((p) => p.slug);

  const cheapest = bestOf(products, (p) => -p.priceCents);
  if (cheapest) {
    const price = -cheapest.best;
    const next = Math.min(...products.filter((p) => !cheapest.winners.includes(p)).map((p) => p.priceCents));
    insights.push({
      key: "lowest_price",
      label: "Lowest price",
      slugs: slugs(cheapest.winners),
      detail: `${formatPrice(price)}, ${formatPrice(next - price)} less than the next cheapest.`,
    });
  }

  const topRated = bestOf(products, (p) => p.rating);
  if (topRated) {
    const only = topRated.winners.length === 1 ? topRated.winners[0] : undefined;
    insights.push({
      key: "top_rated",
      label: "Highest rated",
      slugs: slugs(topRated.winners),
      detail: `${topRated.best.toFixed(1)} out of 5${
        only && only.ratingCount !== null ? ` from ${formatCount(only.ratingCount)} ratings` : ""
      }.`,
    });
  }

  const mostRated = bestOf(products, (p) => p.ratingCount);
  if (mostRated) {
    insights.push({
      key: "most_rated",
      label: "Most rated",
      slugs: slugs(mostRated.winners),
      detail: `${formatCount(mostRated.best)} ratings — the widest base of opinion here.`,
    });
  }

  // A listing without a previous price has no markdown, i.e. 0%.
  const markdown = bestOf(products, (p) => discountPercent(p) ?? 0);
  if (markdown && markdown.best > 0) {
    const only = markdown.winners.length === 1 ? markdown.winners[0] : undefined;
    insights.push({
      key: "largest_markdown",
      label: "Largest markdown",
      slugs: slugs(markdown.winners),
      detail: `${markdown.best}% below the listed previous price${
        only ? ` of ${formatPrice(only.listPriceCents as number)}` : ""
      }.`,
    });
  }

  const options = bestOf(products, (p) => purchasableVariants(p).length);
  if (options) {
    insights.push({
      key: "most_options",
      label: "Most options",
      slugs: slugs(options.winners),
      detail: `${options.best} priced options to choose from.`,
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// relative signals
// ---------------------------------------------------------------------------

export interface Signal {
  key: "price" | "rating" | "popularity" | "markdown";
  label: string;
  /** How the value is derived, shown to the reader. */
  method: string;
  values: { slug: string; ratio: number | null; display: string }[];
}

/**
 * Each signal is a 0–1 ratio relative to the products being compared, so the
 * bars answer "how does this compare with the others here", never "how good
 * is this" in absolute terms.
 */
export function buildSignals(products: CatalogProductDetail[]): Signal[] {
  const minPrice = Math.min(...products.map((p) => p.priceCents));
  const maxCount = Math.max(0, ...products.map((p) => p.ratingCount ?? 0));
  const markdowns = products.map((p) => discountPercent(p));
  const maxMarkdown = Math.max(0, ...markdowns.map((m) => m ?? 0));

  const signals: Signal[] = [
    {
      key: "price",
      label: "Price advantage",
      method: "Lowest price here ÷ this price. The cheapest product fills the bar.",
      values: products.map((p) => ({
        slug: p.slug,
        ratio: minPrice / p.priceCents,
        display: formatPrice(p.priceCents),
      })),
    },
    {
      key: "rating",
      label: "Average rating",
      method: "Average rating out of 5.",
      values: products.map((p) => ({
        slug: p.slug,
        ratio: p.rating === null ? null : p.rating / 5,
        display: p.rating === null ? "Not rated" : `${p.rating.toFixed(1)} / 5`,
      })),
    },
    {
      key: "popularity",
      label: "Rating volume",
      method: "Number of ratings on a log scale, relative to the most-rated product here.",
      values: products.map((p) => ({
        slug: p.slug,
        ratio:
          p.ratingCount === null || maxCount === 0
            ? null
            : Math.log10(p.ratingCount + 1) / Math.log10(maxCount + 1),
        display: p.ratingCount === null ? "No count" : `${formatCount(p.ratingCount)} ratings`,
      })),
    },
  ];

  if (maxMarkdown > 0) {
    signals.push({
      key: "markdown",
      label: "Markdown",
      method: "Percent below the listed previous price, relative to the largest markdown here.",
      values: products.map((p, i) => ({
        slug: p.slug,
        ratio: markdowns[i] === null ? 0 : (markdowns[i] as number) / maxMarkdown,
        display: markdowns[i] === null ? "No previous price" : `${markdowns[i]}% off`,
      })),
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// differences and specifications
// ---------------------------------------------------------------------------

export interface ComparisonRow {
  label: string;
  values: (string | null)[];
  /** True when at least two products show different values. */
  differs: boolean;
}

function normalize(value: string | null): string | null {
  return value === null ? null : value.replace(/\s+/g, " ").trim().toLowerCase();
}

function rowFrom(label: string, values: (string | null)[]): ComparisonRow {
  const present = values.map(normalize).filter((v): v is string => v !== null);
  const differs = new Set(values.map(normalize)).size > 1 && present.length > 0;
  return { label, values, differs };
}

/** Headline attributes every listing has, as comparable rows. */
export function buildOverviewRows(products: CatalogProductDetail[]): ComparisonRow[] {
  return [
    rowFrom("Price", products.map((p) => formatPrice(p.priceCents))),
    rowFrom(
      "Previous price",
      products.map((p) => (discountPercent(p) !== null ? formatPrice(p.listPriceCents as number) : null)),
    ),
    rowFrom("Average rating", products.map((p) => (p.rating === null ? null : `${p.rating.toFixed(1)} / 5`))),
    rowFrom("Ratings", products.map((p) => (p.ratingCount === null ? null : formatCount(p.ratingCount)))),
    rowFrom("Availability", products.map((p) => AVAILABILITY_LABELS[p.availability])),
    rowFrom("Brand", products.map((p) => p.brand)),
    rowFrom("Type", products.map((p) => catalogProductTypeLabel(p.productType))),
    rowFrom("Priced options", products.map((p) => String(purchasableVariants(p).length))),
  ];
}

/**
 * Specification rows: the union of labels across the products, most widely
 * shared first. A product without a label reads as missing — its value is
 * never borrowed from another column.
 */
export function buildSpecRows(products: CatalogProductDetail[]): ComparisonRow[] {
  const counts = new Map<string, { label: string; count: number; first: number }>();
  products.forEach((product) => {
    product.specifications.forEach((spec, index) => {
      const key = spec.label.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label: spec.label, count: 1, first: index });
    });
  });

  return [...counts.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.first - b.first)
    .map(([key, { label }]) =>
      rowFrom(
        label,
        products.map((p) => p.specifications.find((s) => s.label.toLowerCase() === key)?.value ?? null),
      ),
    );
}

/** Rows that actually separate the products: overview rows that differ, and
 *  specifications that at least two products state and that disagree. */
export function buildKeyDifferences(products: CatalogProductDetail[], limit = 10): ComparisonRow[] {
  const overview = buildOverviewRows(products).filter((row) => row.differs);
  const specs = buildSpecRows(products).filter(
    (row) => row.differs && row.values.filter((v) => v !== null).length >= 2,
  );
  return [...overview, ...specs].slice(0, limit);
}

// ---------------------------------------------------------------------------
// tradeoffs
// ---------------------------------------------------------------------------

/**
 * Plain statements of what one product gives up for another, drawn only from
 * price, rating, rating count and availability. Each one is a comparison of
 * two numbers on screen; none is a recommendation.
 */
export function buildTradeoffs(products: CatalogProductDetail[]): string[] {
  const out: string[] = [];
  const name = (p: CatalogProductDetail) => shortName(p);
  if (products.length < 2) return out;

  const byPrice = [...products].sort((a, b) => a.priceCents - b.priceCents);
  const cheapest = byPrice[0];
  const priciest = byPrice[byPrice.length - 1];

  // Only a strict winner counts as "best rated"; a tie is not better.
  const rated = products.filter((p) => p.rating !== null);
  const topRating = rated.length > 0 ? Math.max(...rated.map((p) => p.rating as number)) : null;
  const topRated = rated.filter((p) => p.rating === topRating);
  const bestRated = topRated.length === 1 ? topRated[0] : undefined;

  if (bestRated && cheapest.rating !== null && bestRated.priceCents > cheapest.priceCents) {
    out.push(
      `${name(cheapest)} costs ${formatPrice(bestRated.priceCents - cheapest.priceCents)} less than ${name(
        bestRated,
      )}, which is rated ${((bestRated.rating as number) - cheapest.rating).toFixed(1)} higher.`,
    );
  }

  if (
    priciest.priceCents > cheapest.priceCents &&
    priciest.rating !== null &&
    cheapest.rating !== null &&
    priciest.rating <= cheapest.rating
  ) {
    out.push(
      `${name(priciest)} costs ${formatPrice(priciest.priceCents - cheapest.priceCents)} more than ${name(
        cheapest,
      )} ${
        priciest.rating === cheapest.rating
          ? `at the same average rating (${priciest.rating.toFixed(1)})`
          : `with a lower average rating (${priciest.rating.toFixed(1)} against ${cheapest.rating.toFixed(1)})`
      }.`,
    );
  }

  const marked = products
    .map((p) => ({ p, pct: discountPercent(p) }))
    .filter((m): m is { p: CatalogProductDetail; pct: number } => m.pct !== null)
    .sort((a, b) => b.pct - a.pct);
  const deepest = marked[0];
  if (deepest && deepest.p.priceCents > cheapest.priceCents) {
    out.push(
      `${name(deepest.p)} shows the largest markdown (${deepest.pct}% off) but still costs ${formatPrice(
        deepest.p.priceCents - cheapest.priceCents,
      )} more than ${name(cheapest)}.`,
    );
  }

  const byVolume = [...products].sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
  const most = byVolume[0];
  const fewest = byVolume[byVolume.length - 1];
  if ((most.ratingCount ?? 0) >= 10 * Math.max(1, fewest.ratingCount ?? 0)) {
    out.push(
      `${name(fewest)}'s average rests on ${formatCount(fewest.ratingCount ?? 0)} ratings, against ${formatCount(
        most.ratingCount ?? 0,
      )} for ${name(most)} — the smaller sample says less.`,
    );
  }

  for (const p of products) {
    if (p.availability === "out_of_stock") out.push(`${name(p)} is listed as out of stock.`);
    else if (p.availability === "limited_stock") out.push(`${name(p)} is listed with limited stock.`);
  }

  return out.slice(0, 5);
}
