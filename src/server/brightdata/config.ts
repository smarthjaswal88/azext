/**
 * The authorized Bright Data collection, described as data.
 *
 * Everything the import sends to Bright Data is derived from this file, and the
 * preview action prints it before anything is sent. The limits are also
 * written into the catalog_sync_runs constraints (supabase/migrations/
 * 0005_catalog.sql), and the import records its run before contacting Bright
 * Data, so raising a limit here without a new migration fails before any paid
 * request is made.
 *
 * Endpoint and parameters follow Bright Data's documented Web Scraper API:
 *   POST /datasets/v3/trigger       starts an asynchronous collection
 *   GET  /datasets/v3/progress/:id  reports starting | running | ready | failed | canceled
 *   GET  /datasets/v3/snapshot/:id  downloads the records (202 until ready)
 *   GET  /datasets/:id/metadata     the dataset's output schema (collects nothing)
 * https://docs.brightdata.com/api-reference/web-scraper-api/asynchronous-requests
 */

import type { CategoryId } from "@/lib/types";

export const CATALOG_SOURCE = "bright_data_amazon" as const;

/** Amazon products, discover by keyword. The only dataset this import may use. */
export const AUTHORIZED_DATASET_ID = "gd_l7q7dkf244hwjntr0";

export const BRIGHT_DATA_DATASETS_ROOT = "https://api.brightdata.com/datasets";
export const BRIGHT_DATA_API_BASE = `${BRIGHT_DATA_DATASETS_ROOT}/v3`;

/** Free schema lookup: the dataset's output fields. Collects nothing.
 *  https://docs.brightdata.com/api-reference/marketplace-dataset-api/get-dataset-metadata */
export function datasetMetadataUrl(datasetId: string): string {
  return `${BRIGHT_DATA_DATASETS_ROOT}/${datasetId}/metadata`;
}

/** Bright Data stops discovery after this many records per keyword, and the
 *  normalizer keeps at most this many valid products per product type. */
export const LIMIT_PER_KEYWORD = 6;
/** And after this many records in total. */
export const MAX_RECORDS = 24;

/** Must be sent with a start request. Typing it is the authorization. */
export const START_CONFIRMATION = "IMPORT_MAX_24_PRODUCTS";

/** One search keyword and the single product type it is meant to find. */
export interface KeywordTarget {
  keyword: string;
  category: CategoryId;
  productType: string;
}

export const IMPORT_KEYWORDS: readonly KeywordTarget[] = [
  { keyword: "wireless headphones", category: "headphones", productType: "wireless_headphones" },
  { keyword: "over ear headphones", category: "headphones", productType: "over_ear_headphones" },
  { keyword: "cotton t shirt", category: "clothing", productType: "t_shirt" },
  { keyword: "linen shirt", category: "clothing", productType: "linen_shirt" },
];

/**
 * Requested through `custom_output_fields`, so the snapshot holds only these.
 *
 * Every name here was confirmed against the dataset's own metadata
 * (GET /datasets/gd_l7q7dkf244hwjntr0/metadata, 2026-09-26: 119 fields), and
 * start re-checks them with one free metadata read before the paid request —
 * a name the schema does not have blocks the start instead of reaching
 * Bright Data. Fields for review text, reviewers, sellers and delivery
 * location exist in the schema and are deliberately not requested, so they
 * are never delivered to this server.
 *
 * The schema has no field naming the keyword that found a record and no
 * record timestamp, so neither is requested: products are classified from
 * their own title and Amazon category fields (see normalize.ts), and the
 * fetch time is the time the snapshot was downloaded.
 */
export const OUTPUT_FIELDS = [
  "asin",
  "url",
  "title",
  "brand",
  "description",
  "categories",
  "bs_category",
  "root_bs_category",
  "final_price",
  "initial_price",
  "currency",
  "rating",
  "reviews_count",
  "availability",
  "is_available",
  "image_url",
  "images",
  "features",
  "product_details",
  "variations",
  "origin_url",
] as const;

export interface TriggerRequest {
  method: "POST";
  url: string;
  body: { keyword: string }[];
}

export function buildTriggerRequest(datasetId: string = AUTHORIZED_DATASET_ID): TriggerRequest {
  const params = new URLSearchParams({
    dataset_id: datasetId,
    type: "discover_new",
    discover_by: "keyword",
    include_errors: "true",
    limit_per_input: String(LIMIT_PER_KEYWORD),
    limit_multiple_results: String(MAX_RECORDS),
    custom_output_fields: OUTPUT_FIELDS.join("|"),
  });
  return {
    method: "POST",
    url: `${BRIGHT_DATA_API_BASE}/trigger?${params.toString()}`,
    body: IMPORT_KEYWORDS.map((target) => ({ keyword: target.keyword })),
  };
}

/** Assumptions the preview states before any paid request. */
export const IMPORT_ASSUMPTIONS: readonly string[] = [
  "Billing: Bright Data bills per delivered record, so this collection is capped at 24 billed records by limit_multiple_results=24, with at most 6 per keyword via limit_per_input=6.",
  "Only the trigger request starts a paid collection. The metadata check, progress checks and snapshot downloads start nothing. Bright Data's documentation does not say explicitly whether a repeated download is billed.",
  "Before the paid request, start re-reads the dataset's metadata (free) and refuses to send anything if any requested field is missing from the schema.",
  "Error records (include_errors=true) count toward the 24-record cap, so fewer than 24 products may come back.",
  "Only the fields in custom_output_fields are delivered: no review text, reviewer data, seller data or delivery location.",
  "The dataset does not say which keyword found a record. Each product is classified from its own title and Amazon category fields into one of the four product types; a record that fits none, fits more than one, or whose categories contradict its title is skipped. The 6-per-keyword limit is applied per product type.",
  "No zipcode is sent, so prices and availability are whatever Amazon shows Bright Data's default US location.",
  "A record is only imported with an ASIN, an Amazon product URL, a title and a USD price. Anything missing is left empty, never filled in, and a record lacking a required field is skipped with a reason.",
  "The dataset has no record timestamp field, so fetched_at is the time the snapshot was downloaded.",
  "Image URLs are stored only when they point at Amazon's image CDN over https. No image is downloaded.",
  "Snapshots stay downloadable for a limited time after collection (Bright Data documents 16 days on one page and 30 on another). A run can be resumed or re-imported from its snapshot within that window without a new collection.",
];
