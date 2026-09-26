/**
 * Turns Bright Data Amazon records into catalog rows — strictly.
 *
 * Rules:
 *   - Only fields requested through custom_output_fields are read (see
 *     OUTPUT_FIELDS in config.ts, each confirmed against the dataset's
 *     metadata). Anything else in a record is never copied anywhere.
 *   - Missing values stay missing. Nothing is defaulted, estimated or borrowed
 *     from a neighbouring field or record. A product needs an ASIN, an Amazon
 *     URL, a title and a USD price; without one of those it is skipped, with
 *     a reason.
 *   - Classification uses the record's own content — its title and Amazon's
 *     category fields — because the dataset does not say which search keyword
 *     found a record. A record that fits no product type, fits more than one,
 *     or whose categories contradict its title is skipped, never guessed.
 *   - Every string is cleaned (markup and control characters removed,
 *     whitespace collapsed) and length-capped before it goes near the
 *     database, which re-checks the same limits.
 *
 * Pure: no I/O, so it can be exercised against saved or synthetic records.
 */

import type { CatalogAvailability } from "@/lib/catalog-api";
import type { CategoryId } from "@/lib/types";
import {
  IMPORT_KEYWORDS,
  LIMIT_PER_KEYWORD,
  MAX_RECORDS,
  OUTPUT_FIELDS,
  type KeywordTarget,
} from "./config";

export interface NormalizedVariant {
  sourceVariantId: string;
  label: string | null;
  options: Record<string, string>;
  priceCents: number | null;
  currency: string | null;
  availability: CatalogAvailability;
  isDefault: boolean;
}

export interface NormalizedSpecification {
  kind: "specification" | "feature";
  label: string | null;
  value: string;
}

export interface NormalizedProduct {
  sourceProductId: string;
  sourceUrl: string;
  slug: string;
  title: string;
  brand: string | null;
  category: CategoryId;
  productType: string;
  description: string | null;
  priceCents: number;
  listPriceCents: number | null;
  currency: "USD";
  rating: number | null;
  ratingCount: number | null;
  availability: CatalogAvailability;
  availabilityText: string | null;
  imageUrl: string | null;
  sourceCategories: string[];
  /** The search keyword, only when origin_url shows it. Never inferred. */
  discoveryKeyword: string | null;
  fetchedAt: string;
  variants: NormalizedVariant[];
  specifications: NormalizedSpecification[];
}

export type SkipReason =
  | "not_an_object"
  | "empty_record"
  | "missing_asin"
  | "missing_title"
  | "missing_source_url"
  | "ambiguous_type"
  | "category_conflict"
  | "accessory"
  | "off_topic"
  | "missing_price"
  | "missing_currency"
  | "unsupported_currency"
  | "duplicate"
  | "keyword_limit_reached"
  | "total_limit_reached";

export type NormalizeResult =
  | { ok: true; product: NormalizedProduct }
  | { ok: false; reason: SkipReason; productType?: string };

// ---------------------------------------------------------------------------
// field readers
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

/** Markup, control and invisible formatting characters removed, whitespace
 *  collapsed, capped at `max` characters on a word boundary where possible. */
function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\p{Cf}/gu, "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  if (text.length <= max) return text;
  // Never end on half of a surrogate pair: Postgres rejects it inside jsonb.
  const cut = text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, "");
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

function firstText(values: unknown[], max: number): string | undefined {
  for (const value of values) {
    const text = cleanText(value, max);
    if (text) return text;
  }
  return undefined;
}

const ASIN = /^[A-Z0-9]{10}$/;

function readAsin(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const asin = value.trim().toUpperCase();
  return ASIN.test(asin) ? asin : undefined;
}

function asinFromUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /\/(?:dp|gp\/product)\/([A-Za-z0-9]{10})(?:[/?#]|$)/.exec(value);
  return match ? readAsin(match[1]) : undefined;
}

const AMAZON_HOST =
  /^(?:www\.|smile\.)?amazon\.(?:com|ca|com\.mx|com\.br|co\.uk|de|fr|it|es|nl|se|pl|com\.be|com\.tr|ae|sa|eg|in|co\.jp|sg|com\.au)$/;

/** The product page on the record's own Amazon domain, reduced to /dp/ASIN.
 *  Dropping the rest removes search, session and referral parameters. */
function canonicalSourceUrl(value: unknown, asin: string): string | undefined {
  if (typeof value !== "string" || value.length > 2000) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  const host = url.hostname.toLowerCase();
  if (!AMAZON_HOST.test(host)) return undefined;
  const canonicalHost = host.startsWith("www.")
    ? host
    : host.startsWith("smile.")
      ? `www.${host.slice("smile.".length)}`
      : `www.${host}`;
  return `https://${canonicalHost}/dp/${asin}`;
}

const IMAGE_HOSTS = new Set([
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "images-eu.ssl-images-amazon.com",
  "images-fe.ssl-images-amazon.com",
]);

/** An https URL on Amazon's image CDN, or nothing. */
function permittedImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 500) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  if (!IMAGE_HOSTS.has(url.hostname.toLowerCase())) return undefined;
  return url.toString();
}

/** Positive money in cents from a number (29.99) or a plain price string
 *  ("$1,299.00"). Zero, negatives and anything ambiguous are rejected. */
function toCents(value: unknown): number | undefined {
  let amount: number | undefined;
  if (typeof value === "number") {
    amount = value;
  } else if (typeof value === "string") {
    const match = /^\s*(?:US\s*)?\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*$/.exec(value);
    if (!match) return undefined;
    amount = Number(`${match[1].replace(/,/g, "")}.${match[2] ?? "0"}`);
  }
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return undefined;
  }
  return Math.round(amount * 100);
}

function readCurrency(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : undefined;
}

function readRating(value: unknown): number | undefined {
  let n: number | undefined;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") {
    const match = /^\s*(\d(?:\.\d+)?)\b/.exec(value);
    n = match ? Number(match[1]) : undefined;
  }
  if (n === undefined || !Number.isFinite(n) || n < 0 || n > 5) return undefined;
  return Math.round(n * 10) / 10;
}

function readCount(value: unknown): number | undefined {
  let n: number | undefined;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") {
    const match = /^\s*(\d{1,3}(?:,\d{3})+|\d+)\b/.exec(value);
    n = match ? Number(match[1].replace(/,/g, "")) : undefined;
  }
  if (n === undefined || !Number.isInteger(n) || n < 0 || n > 1_000_000_000) return undefined;
  return n;
}

/** "Visit the Sony Store" and "Brand: Sony" are how Amazon labels a brand
 *  link; the brand is the name inside. */
function readBrand(value: unknown): string | undefined {
  const text = cleanText(value, 160);
  if (!text) return undefined;
  const store = /^visit the (.+) store$/i.exec(text);
  const brand = (store ? store[1] : text.replace(/^brand:\s*/i, "")).trim();
  return brand && brand.length <= 120 ? brand : undefined;
}

function readAvailability(text: string | undefined, isAvailable: unknown): CatalogAvailability {
  if (text) {
    if (/currently unavailable|out of stock|unavailable/i.test(text)) return "out_of_stock";
    if (/\bonly \d+ left\b/i.test(text)) return "limited_stock";
    if (/\bin stock\b/i.test(text)) return "in_stock";
  }
  if (isAvailable === true) return "in_stock";
  if (isAvailable === false) return "out_of_stock";
  return "unknown";
}

function readStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const text = cleanText(item, maxLength);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Detail rows that are volatile, identifying or about reviews and sellers
 *  are not specifications and are dropped. */
const EXCLUDED_DETAIL = /(review|rating|seller|rank|asin|customer|upc|ean|gtin|isbn)/i;

function readSpecifications(value: unknown): NormalizedSpecification[] {
  const pairs: [unknown, unknown][] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const row = asObject(item);
      if (row) pairs.push([row.type ?? row.label ?? row.name, row.value]);
    }
  } else {
    const map = asObject(value);
    if (map) pairs.push(...Object.entries(map));
  }

  const out: NormalizedSpecification[] = [];
  const seen = new Set<string>();
  for (const [rawLabel, rawValue] of pairs) {
    const label = cleanText(rawLabel, 120)?.replace(/\s*:$/, "");
    const text = cleanText(rawValue, 500)?.replace(/^:\s*/, "");
    if (!label || !text || EXCLUDED_DETAIL.test(label)) continue;
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ kind: "specification", label, value: text });
    if (out.length >= 40) break;
  }
  return out;
}

const OPTION_KEYS = ["color", "size", "style", "pattern", "material"] as const;

/**
 * The listing's own ASIN is always the default variant. Other variations are
 * kept only with a valid ASIN; a variation's price is used only when the
 * source gives one in USD — otherwise it has no price and cannot be bought.
 */
function readVariants(
  value: unknown,
  product: { asin: string; priceCents: number; availability: CatalogAvailability },
): NormalizedVariant[] {
  const byAsin = new Map<string, NormalizedVariant>();

  for (const item of Array.isArray(value) ? value : []) {
    const row = asObject(item);
    const asin = readAsin(row?.asin);
    if (!row || !asin || byAsin.has(asin)) continue;

    const options: Record<string, string> = {};
    for (const key of OPTION_KEYS) {
      const option = cleanText(row[key], 80);
      if (option) options[key] = option;
    }

    const currency = readCurrency(row.currency);
    const price = toCents(row.price ?? row.final_price);
    const priced = price !== undefined && currency === "USD";

    byAsin.set(asin, {
      sourceVariantId: asin,
      label: firstText([row.name, row.variant_name, row.title], 200) ?? null,
      options,
      priceCents: priced ? price : null,
      currency: priced ? currency : null,
      availability: readAvailability(cleanText(row.availability, 200), row.is_available),
      isDefault: false,
    });
    if (byAsin.size >= 30) break;
  }

  // The listing itself: same ASIN, so the listing's own price and
  // availability are this option's price and availability.
  const own = byAsin.get(product.asin);
  const defaultVariant: NormalizedVariant = {
    sourceVariantId: product.asin,
    label: own?.label ?? null,
    options: own?.options ?? {},
    priceCents: product.priceCents,
    currency: "USD",
    availability: product.availability,
    isDefault: true,
  };
  byAsin.delete(product.asin);

  return [defaultVariant, ...byAsin.values()];
}

function slugFor(title: string, asin: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .split("-")
    .filter(Boolean);
  let base = "";
  for (const word of words) {
    const next = base ? `${base}-${word}` : word;
    if (next.length > 60) break;
    base = next;
  }
  return base ? `${base}-${asin.toLowerCase()}` : asin.toLowerCase();
}

// ---------------------------------------------------------------------------
// classification
// ---------------------------------------------------------------------------

const HEADPHONE_WORDS = /\b(head ?phones?|ear ?buds?|ear ?phones?|headsets?)\b/i;
const HEADPHONE_ACCESSORY =
  /\b(ear ?pads?|ear ?cushions?|ear ?tips?|replacement|(head ?phones?|ear ?buds?) (stand|holder|hanger|hook|case|cover|adapter|splitter)s?)\b/i;
const OVER_EAR = /\b(over[- ]?(the[- ])?ear|around[- ](the[- ])?ear)\b/i;
const IN_EAR = /\b(ear ?buds?|in[- ]ear)\b/i;
const WIRELESS = /\b(wireless|bluetooth)\b/i;

const T_SHIRT = /\b(t[- ]?shirts?|tee[- ]?shirts?)\b/i;
const TEE = /\btees?\b/i;
const LINEN = /\blinen\b/i;
/** "shirt" as its own word — not the tail of "t-shirt" or "tee shirt". */
const PLAIN_SHIRT = /(?<!\bt[- ]?)(?<!\btee[- ]?)\bshirts?\b/i;
const CLOTHING_ACCESSORY = /\b(transfer paper|folding board|iron[- ]on|hangers?|mock-?ups?|stencils?)\b/i;

const TAXONOMY_HEADPHONES = /\b(headphones?|earbuds?|earphones?)\b/i;
const TAXONOMY_CLOTHING = /\b(clothing|apparel|shirts?|t-shirts?|tops|tees)\b/i;
const TAXONOMY_ELECTRONICS = /\b(electronics|cell phones|computers)\b/i;

type Classification = { ok: true; target: KeywordTarget } | { ok: false; reason: SkipReason };

function targetOf(productType: string): KeywordTarget {
  const target = IMPORT_KEYWORDS.find((t) => t.productType === productType);
  if (!target) throw new Error(`No keyword target for ${productType}`);
  return target;
}

/**
 * Places a product in exactly one of the four product types from its title
 * and Amazon's own category labels (categories, bs_category,
 * root_bs_category), or explains why it cannot:
 *   ambiguous_type     it reads as both headphones and clothing, or as both a
 *                      linen shirt and a t-shirt
 *   category_conflict  Amazon files it somewhere its title contradicts
 *   accessory          ear pads, stands, transfer paper and the like
 *   off_topic          none of the four types
 *
 * Within headphones, over-ear is the form factor and wins when stated;
 * otherwise wireless or bluetooth headphones and earbuds are
 * wireless_headphones. A wired, non-over-ear pair fits neither and is skipped,
 * and so does anything described as both over-ear and in-ear. Amazon's parent
 * label "Headphones, Earbuds & Accessories" covers every form factor, so only
 * a specific "In-Ear" label counts as in-ear.
 */
export function classifyProduct(title: string, taxonomy: string[]): Classification {
  const tax = taxonomy.join(" | ");
  const titleSaysHeadphones = HEADPHONE_WORDS.test(title);
  const titleSaysClothing = T_SHIRT.test(title) || TEE.test(title) || PLAIN_SHIRT.test(title);
  const taxSaysHeadphones = TAXONOMY_HEADPHONES.test(tax);
  const taxSaysClothing = TAXONOMY_CLOTHING.test(tax) && !taxSaysHeadphones;
  const taxSaysElectronics = TAXONOMY_ELECTRONICS.test(tax) || taxSaysHeadphones;

  const headphones = titleSaysHeadphones || taxSaysHeadphones;
  const clothing = titleSaysClothing || taxSaysClothing;

  if (headphones && clothing) {
    // "Headphones T-Shirt" is a shirt with a print, or a mislabelled listing;
    // either way the title and the categories disagree.
    return { ok: false, reason: titleSaysHeadphones && titleSaysClothing ? "ambiguous_type" : "category_conflict" };
  }

  if (headphones) {
    if (HEADPHONE_ACCESSORY.test(title)) return { ok: false, reason: "accessory" };
    const titleOverEar = OVER_EAR.test(title);
    const overEar = titleOverEar || /\bover-ear\b/i.test(tax);
    const titleInEar = IN_EAR.test(title);
    const inEar = titleInEar || /\bin-ear\b/i.test(tax);
    if (overEar && inEar) {
      return { ok: false, reason: titleOverEar && titleInEar ? "ambiguous_type" : "category_conflict" };
    }
    if (overEar) return { ok: true, target: targetOf("over_ear_headphones") };
    if (WIRELESS.test(title) || /\b(true wireless|wireless)\b/i.test(tax)) {
      return { ok: true, target: targetOf("wireless_headphones") };
    }
    return { ok: false, reason: "off_topic" };
  }

  if (clothing) {
    if (taxSaysElectronics) return { ok: false, reason: "category_conflict" };
    if (CLOTHING_ACCESSORY.test(title)) return { ok: false, reason: "accessory" };
    const linenShirt = LINEN.test(title) && PLAIN_SHIRT.test(title);
    const tShirt = T_SHIRT.test(title) || (TEE.test(title) && !PLAIN_SHIRT.test(title)) || /\bt-shirts?\b/i.test(tax);
    if (linenShirt && T_SHIRT.test(title)) return { ok: false, reason: "ambiguous_type" };
    if (linenShirt) return { ok: true, target: targetOf("linen_shirt") };
    if (tShirt) return { ok: true, target: targetOf("t_shirt") };
    return { ok: false, reason: "off_topic" };
  }

  return { ok: false, reason: "off_topic" };
}

/**
 * The search keyword, when origin_url is an Amazon search for one of the
 * configured keywords. It records how a product was found and nothing more:
 * the product type always comes from classifyProduct.
 */
function keywordFromOriginUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2000) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (!AMAZON_HOST.test(url.hostname.toLowerCase()) || url.pathname !== "/s") return undefined;
  const k = url.searchParams.get("k")?.replace(/\s+/g, " ").trim().toLowerCase();
  return IMPORT_KEYWORDS.find((target) => target.keyword === k)?.keyword;
}

// ---------------------------------------------------------------------------
// one record
// ---------------------------------------------------------------------------

export function normalizeRecord(raw: unknown, receivedAt: Date): NormalizeResult {
  const record = asObject(raw);
  if (!record) return { ok: false, reason: "not_an_object" };

  if (!["asin", "url", "title"].some((field) => record[field] !== undefined && record[field] !== null)) {
    return { ok: false, reason: "empty_record" };
  }

  const asin = readAsin(record.asin) ?? asinFromUrl(record.url);
  if (!asin) return { ok: false, reason: "missing_asin" };

  const title = cleanText(record.title, 500);
  if (!title) return { ok: false, reason: "missing_title" };

  const sourceUrl = canonicalSourceUrl(record.url, asin);
  if (!sourceUrl) return { ok: false, reason: "missing_source_url" };

  const sourceCategories = readStringList(record.categories, 8, 120);
  const taxonomy = [
    ...sourceCategories,
    ...readStringList(record.bs_category, 1, 120),
    ...readStringList(record.root_bs_category, 1, 120),
  ];
  const classification = classifyProduct(title, taxonomy);
  if (!classification.ok) return { ok: false, reason: classification.reason };
  const { target } = classification;

  const priceCents = toCents(record.final_price);
  if (priceCents === undefined) return { ok: false, reason: "missing_price", productType: target.productType };

  const currency = readCurrency(record.currency);
  if (!currency) return { ok: false, reason: "missing_currency", productType: target.productType };
  // The storefront's money model is USD only.
  if (currency !== "USD") {
    return { ok: false, reason: "unsupported_currency", productType: target.productType };
  }

  const listPrice = toCents(record.initial_price);
  const availabilityText = cleanText(record.availability, 200);
  const availability = readAvailability(availabilityText, record.is_available);

  const imageCandidates = [record.image_url, ...(Array.isArray(record.images) ? record.images.slice(0, 5) : [])];
  const imageUrl = imageCandidates.map(permittedImageUrl).find(Boolean);

  const features = readStringList(record.features, 12, 500).map(
    (value): NormalizedSpecification => ({ kind: "feature", label: null, value }),
  );

  const description = Array.isArray(record.description)
    ? cleanText(record.description.filter((d) => typeof d === "string").join(" "), 5000)
    : cleanText(record.description, 5000);

  return {
    ok: true,
    product: {
      sourceProductId: asin,
      sourceUrl,
      slug: slugFor(title, asin),
      title,
      brand: readBrand(record.brand) ?? null,
      category: target.category,
      productType: target.productType,
      description: description ?? null,
      priceCents,
      listPriceCents: listPrice !== undefined && listPrice > priceCents ? listPrice : null,
      currency: "USD",
      rating: readRating(record.rating) ?? null,
      ratingCount: readCount(record.reviews_count) ?? null,
      availability,
      availabilityText: availabilityText ?? null,
      imageUrl: imageUrl ?? null,
      sourceCategories,
      discoveryKeyword: keywordFromOriginUrl(record.origin_url) ?? null,
      // The dataset has no record timestamp; the download time is when this
      // record was fetched.
      fetchedAt: receivedAt.toISOString(),
      variants: readVariants(record.variations, { asin, priceCents, availability }),
      specifications: [...readSpecifications(record.product_details), ...features],
    },
  };
}

// ---------------------------------------------------------------------------
// a whole snapshot
// ---------------------------------------------------------------------------

export interface ProductTypeCounts {
  /** Records classified as this product type. */
  classified: number;
  accepted: number;
  skipped: number;
}

export interface FieldCoverage {
  acceptedProducts: number;
  /** Accepted products whose origin_url named the search keyword. */
  withDiscoveryKeyword: number;
  withBrand: number;
  withDescription: number;
  withListPrice: number;
  withRating: number;
  withRatingCount: number;
  withKnownAvailability: number;
  withImageUrl: number;
  withSourceCategories: number;
  withSpecifications: number;
  withFeatures: number;
  withVariations: number;
  /** How many records carried each requested field, by name. Never values. */
  sourceFieldsPresent: Record<string, number>;
  /** Names of fields that arrived although they were not requested. */
  unexpectedFields: string[];
}

export interface NormalizedBatch {
  products: NormalizedProduct[];
  fetched: number;
  skipped: number;
  skipReasons: Partial<Record<SkipReason, number>>;
  /** Keyed by product type, plus "unclassified" for records that never got one. */
  typeCounts: Record<string, ProductTypeCounts>;
  coverage: FieldCoverage;
}

const UNCLASSIFIED = "unclassified";

/**
 * Normalizes every record and applies the collection limits a second time:
 * at most LIMIT_PER_KEYWORD valid products per product type (one type per
 * keyword) and MAX_RECORDS in total, first come first kept, one row per ASIN.
 */
export function normalizeSnapshot(records: unknown[], receivedAt: Date): NormalizedBatch {
  const products: NormalizedProduct[] = [];
  const skipReasons: Partial<Record<SkipReason, number>> = {};
  const typeCounts: Record<string, ProductTypeCounts> = {};
  const seenAsins = new Set<string>();
  const acceptedPerType = new Map<string, number>();
  const requested = new Set<string>(OUTPUT_FIELDS);
  const sourceFieldsPresent: Record<string, number> = {};
  const unexpected = new Set<string>();

  const counts = (productType: string | undefined) => {
    const key = productType ?? UNCLASSIFIED;
    typeCounts[key] ??= { classified: 0, accepted: 0, skipped: 0 };
    return typeCounts[key];
  };
  const skip = (reason: SkipReason, productType: string | undefined) => {
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
    counts(productType).skipped += 1;
  };

  for (const raw of records) {
    const record = asObject(raw);
    if (record) {
      for (const [field, value] of Object.entries(record)) {
        if (!requested.has(field)) unexpected.add(field);
        else if (value !== null && value !== undefined) {
          sourceFieldsPresent[field] = (sourceFieldsPresent[field] ?? 0) + 1;
        }
      }
    }

    const result = normalizeRecord(raw, receivedAt);
    const productType = result.ok ? result.product.productType : result.productType;
    counts(productType).classified += productType ? 1 : 0;

    if (!result.ok) {
      skip(result.reason, productType);
      continue;
    }

    const { product } = result;
    if (seenAsins.has(product.sourceProductId)) {
      skip("duplicate", product.productType);
      continue;
    }
    if ((acceptedPerType.get(product.productType) ?? 0) >= LIMIT_PER_KEYWORD) {
      skip("keyword_limit_reached", product.productType);
      continue;
    }
    if (products.length >= MAX_RECORDS) {
      skip("total_limit_reached", product.productType);
      continue;
    }

    seenAsins.add(product.sourceProductId);
    acceptedPerType.set(product.productType, (acceptedPerType.get(product.productType) ?? 0) + 1);
    counts(product.productType).accepted += 1;
    products.push(product);
  }

  const count = (test: (p: NormalizedProduct) => boolean) => products.filter(test).length;

  return {
    products,
    fetched: records.length,
    skipped: records.length - products.length,
    skipReasons,
    typeCounts,
    coverage: {
      acceptedProducts: products.length,
      withDiscoveryKeyword: count((p) => p.discoveryKeyword !== null),
      withBrand: count((p) => p.brand !== null),
      withDescription: count((p) => p.description !== null),
      withListPrice: count((p) => p.listPriceCents !== null),
      withRating: count((p) => p.rating !== null),
      withRatingCount: count((p) => p.ratingCount !== null),
      withKnownAvailability: count((p) => p.availability !== "unknown"),
      withImageUrl: count((p) => p.imageUrl !== null),
      withSourceCategories: count((p) => p.sourceCategories.length > 0),
      withSpecifications: count((p) => p.specifications.some((s) => s.kind === "specification")),
      withFeatures: count((p) => p.specifications.some((s) => s.kind === "feature")),
      withVariations: count((p) => p.variants.length > 1),
      sourceFieldsPresent,
      unexpectedFields: [...unexpected].sort(),
    },
  };
}
