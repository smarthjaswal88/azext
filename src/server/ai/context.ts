/**
 * The evidence the decision assistant is given — built only from live catalog
 * data, loaded on the server by product id.
 *
 * Pure: it takes catalog product details (the same shape the catalog API
 * returns) and the shopper's need, and returns both the JSON the model sees and
 * the means to check what the model says against it. No I/O, no provider.
 *
 * Sent per product, when present in the listing:
 *   title, brand, category, product type, price, previous price, average
 *   rating, rating count, availability, the budget check, up to 8 feature
 *   bullets, up to 24 specifications, and up to 8 priced options.
 * Never sent: review text (none was imported), seller data, images, URLs.
 */

import {
  catalogCategoryLabel,
  catalogProductTypeLabel,
  type CatalogProductDetail,
} from "@/lib/catalog-api";
import { AVAILABILITY_LABELS, purchasableVariants } from "@/lib/compare-insights";
import { formatCount, formatPrice } from "@/lib/format";

export const CONTEXT_LIMITS = {
  features: 8,
  featureChars: 240,
  specifications: 24,
  specificationChars: 160,
  options: 8,
} as const;

export interface ContextProduct {
  slug: string;
  title: string;
  brand: string | null;
  category: string;
  productType: string;
  priceCents: number;
  previousPriceCents: number | null;
  rating: number | null;
  ratingCount: number | null;
  availability: CatalogProductDetail["availability"];
  /** Computed here in integer cents; null when no budget was stated. */
  withinStatedBudget: boolean | null;
  features: { n: number; text: string }[];
  specifications: { label: string; value: string }[];
  pricedOptions: { n: number; label: string; priceCents: number }[];
}

export interface GuidanceContext {
  need: string;
  budgetCents: number | undefined;
  products: ContextProduct[];
}

function cap(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Finds a stated budget ceiling in the need ("under $100", "max 80",
 * "$60"). The tightest one binds. Parsed here so every budget comparison is
 * integer arithmetic in code — the model is told the answer, not asked it.
 */
export function parseBudgetCents(need: string): number | undefined {
  const text = need.toLowerCase();
  const keyed = [
    ...text.matchAll(
      /(?:under|below|less than|max(?:imum)?|up to|at most|budget(?: of| is)?|within|<=?)\s*\$?\s*(\d{1,6})(?:\.(\d{1,2}))?/g,
    ),
  ];
  const all = keyed.length > 0 ? keyed : [...text.matchAll(/\$\s*(\d{1,6})(?:\.(\d{1,2}))?/g)];
  if (all.length === 0) return undefined;
  return Math.min(...all.map((m) => Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, "0")) : 0)));
}

function optionLabel(v: { label: string | null; options: Record<string, string> }): string {
  return v.label ?? (Object.values(v.options).filter(Boolean).join(" · ") || "Standard option");
}

export function buildGuidanceContext(products: CatalogProductDetail[], need: string): GuidanceContext {
  const budgetCents = parseBudgetCents(need);
  return {
    need,
    budgetCents,
    products: products.map((p) => ({
      slug: p.slug,
      title: p.title,
      brand: p.brand,
      category: p.category,
      productType: p.productType,
      priceCents: p.priceCents,
      previousPriceCents:
        p.listPriceCents !== null && p.listPriceCents > p.priceCents ? p.listPriceCents : null,
      rating: p.rating,
      ratingCount: p.ratingCount,
      availability: p.availability,
      withinStatedBudget: budgetCents === undefined ? null : p.priceCents <= budgetCents,
      features: p.features
        .slice(0, CONTEXT_LIMITS.features)
        .map((text, i) => ({ n: i + 1, text: cap(text, CONTEXT_LIMITS.featureChars) })),
      specifications: p.specifications
        .slice(0, CONTEXT_LIMITS.specifications)
        .map((s) => ({ label: s.label, value: cap(s.value, CONTEXT_LIMITS.specificationChars) })),
      pricedOptions: purchasableVariants(p)
        .slice(0, CONTEXT_LIMITS.options)
        .map((v, i) => ({ n: i + 1, label: cap(optionLabel(v), 120), priceCents: v.priceCents as number })),
    })),
  };
}

const usd = (cents: number) => Math.round(cents) / 100;

/** The exact JSON the model receives. Prices in dollars for readability; every
 *  number is copied from the catalog, none is computed by the model. */
export function modelPayload(context: GuidanceContext): string {
  return JSON.stringify({
    need: context.need,
    statedBudgetUsd: context.budgetCents === undefined ? null : usd(context.budgetCents),
    products: context.products.map((p) => ({
      slug: p.slug,
      title: p.title,
      brand: p.brand,
      category: catalogCategoryLabel(p.category),
      productType: catalogProductTypeLabel(p.productType),
      priceUsd: usd(p.priceCents),
      previousPriceUsd: p.previousPriceCents === null ? null : usd(p.previousPriceCents),
      rating: p.rating,
      ratingCount: p.ratingCount,
      availability: AVAILABILITY_LABELS[p.availability],
      withinStatedBudget: p.withinStatedBudget,
      features: p.features,
      specifications: p.specifications,
      pricedOptions: p.pricedOptions.map((o) => ({ n: o.n, label: o.label, priceUsd: usd(o.priceCents) })),
    })),
  });
}

export interface ResolvedField {
  label: string;
  value: string;
}

/**
 * Resolves a field reference the model cited to the live value in the
 * context, or undefined when the product has no such field. This is what makes
 * every piece of displayed evidence a real catalog value.
 */
export function resolveField(product: ContextProduct, field: string): ResolvedField | undefined {
  switch (field) {
    case "title":
      return { label: "Title", value: product.title };
    case "brand":
      return product.brand ? { label: "Brand", value: product.brand } : undefined;
    case "category":
      return { label: "Category", value: catalogCategoryLabel(product.category) };
    case "productType":
      return { label: "Product type", value: catalogProductTypeLabel(product.productType) };
    case "price":
      return { label: "Price", value: formatPrice(product.priceCents) };
    case "previousPrice":
      return product.previousPriceCents === null
        ? undefined
        : { label: "Previous price", value: formatPrice(product.previousPriceCents) };
    case "rating":
      return product.rating === null ? undefined : { label: "Average rating", value: `${product.rating.toFixed(1)} out of 5` };
    case "ratingCount":
      return product.ratingCount === null
        ? undefined
        : { label: "Rating count", value: `${formatCount(product.ratingCount)} ratings` };
    case "availability":
      return { label: "Availability", value: AVAILABILITY_LABELS[product.availability] };
  }

  const feature = /^feature:(\d{1,2})$/.exec(field);
  if (feature) {
    const found = product.features.find((f) => f.n === Number(feature[1]));
    return found ? { label: `Feature ${found.n}`, value: found.text } : undefined;
  }

  const option = /^option:(\d{1,2})$/.exec(field);
  if (option) {
    const found = product.pricedOptions.find((o) => o.n === Number(option[1]));
    return found ? { label: "Priced option", value: `${found.label} — ${formatPrice(found.priceCents)}` } : undefined;
  }

  const spec = /^spec:(.{1,120})$/.exec(field);
  if (spec) {
    const wanted = spec[1].trim().toLowerCase();
    const found = product.specifications.find((s) => s.label.toLowerCase() === wanted);
    return found ? { label: `Specification · ${found.label}`, value: found.value } : undefined;
  }

  return undefined;
}

/** Canonical form of a reference, so "spec:item weight" and "spec:Item Weight"
 *  count once. */
export function canonicalField(product: ContextProduct, field: string): string | undefined {
  const spec = /^spec:(.{1,120})$/.exec(field);
  if (spec) {
    const wanted = spec[1].trim().toLowerCase();
    const found = product.specifications.find((s) => s.label.toLowerCase() === wanted);
    return found ? `spec:${found.label}` : undefined;
  }
  return resolveField(product, field) ? field : undefined;
}
