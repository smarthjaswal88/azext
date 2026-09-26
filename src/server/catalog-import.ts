/**
 * The Bright Data -> Supabase catalog import, in three explicit steps.
 *
 *   preview  Checks configuration and the database, and describes the exact
 *            request that start would send. Makes no external request.
 *   start    Records a run, then sends the one paid request (the trigger) and
 *            stores the snapshot id Bright Data returns.
 *   resume   Checks the collection's progress and, once it is ready, downloads
 *            the snapshot, normalizes it and upserts it. Never starts another
 *            collection, so it is safe to call repeatedly.
 *
 * Paid-request guards, all checked before anything paid is sent:
 *   - start refuses while any earlier run was accepted by Bright Data or may
 *     have been (trigger_state 'accepted' or 'unknown'), unless the caller
 *     passes authorizeAdditionalPaidRun set to that run's id — naming the
 *     specific run being superseded, not a blanket override;
 *   - start re-reads the dataset's metadata (free) and refuses if any
 *     requested output field is not in the schema;
 *   - two concurrent starts are stopped by the database's one-active-run
 *     index.
 *
 * Nothing returned or stored here contains a token, a key, an upstream error
 * body or a raw Bright Data record — only counts, codes and normalized rows.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  AUTHORIZED_DATASET_ID,
  BRIGHT_DATA_API_BASE,
  CATALOG_SOURCE,
  IMPORT_ASSUMPTIONS,
  IMPORT_KEYWORDS,
  LIMIT_PER_KEYWORD,
  MAX_RECORDS,
  OUTPUT_FIELDS,
  START_CONFIRMATION,
  buildTriggerRequest,
  datasetMetadataUrl,
} from "./brightdata/config";
import {
  BrightDataError,
  downloadSnapshot,
  fetchDatasetFields,
  getSnapshotStatus,
  hasBrightDataToken,
  isSnapshotId,
  triggerKeywordDiscovery,
  type DatasetField,
  type SnapshotDownload,
  type SnapshotStatus,
} from "./brightdata/client";
import { normalizeSnapshot, type NormalizedProduct } from "./brightdata/normalize";
import { getServiceClient, missingSupabaseVars, secretKeyProblem } from "./supabase";

export interface ImportOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
}

const CATALOG_TABLES = [
  "catalog_products",
  "catalog_variants",
  "catalog_specifications",
  "catalog_sync_runs",
] as const;

const ACTIVE_STATUSES = ["pending", "collecting", "importing"] as const;
const PAID_TRIGGER_STATES = ["accepted", "unknown"] as const;

const RUN_COLUMNS =
  "id, status, trigger_state, snapshot_id, fetched_count, imported_count, updated_count, " +
  "skipped_count, failed_count, skip_reasons, failure_codes, keyword_counts, field_coverage, " +
  "error_code, started_at, triggered_at, finished_at";

interface RunRow {
  id: string;
  status: string;
  trigger_state: string;
  snapshot_id: string | null;
  fetched_count: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  skip_reasons: Record<string, number>;
  failure_codes: Record<string, number>;
  keyword_counts: Record<string, unknown>;
  field_coverage: Record<string, unknown>;
  error_code: string | null;
  started_at: string;
  triggered_at: string | null;
  finished_at: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMissingRelation(error: PostgrestError): boolean {
  return error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42P01";
}

/** The service client, or why there is none. createClient throws on a
 *  malformed URL; that is a configuration problem to report, not a crash. */
function serviceClient(): { client?: SupabaseClient; problem?: string } {
  try {
    const client = getServiceClient();
    if (client) return { client };
  } catch {
    return { problem: "NEXT_PUBLIC_SUPABASE_URL is not a valid http(s) URL." };
  }
  const keyProblem = secretKeyProblem();
  return {
    problem: keyProblem
      ? `Supabase key rejected: ${keyProblem}.`
      : `Supabase is not configured. Missing: ${missingSupabaseVars().join(", ")}.`,
  };
}

function resumeCommand(runId: string): string {
  return `npm run catalog:resume -- ${runId}`;
}

/** The exact request start sends, with the token shown as a placeholder. */
export function describeTriggerRequest() {
  const request = buildTriggerRequest(AUTHORIZED_DATASET_ID);
  const url = new URL(request.url);
  return {
    method: request.method,
    endpoint: `${url.origin}${url.pathname}`,
    query: Object.fromEntries(url.searchParams),
    url: request.url,
    headers: {
      Authorization: "Bearer <BRIGHT_DATA_API_TOKEN, read from the server environment, never shown>",
      "Content-Type": "application/json",
    },
    body: request.body,
  };
}

// ---------------------------------------------------------------------------
// preflight
// ---------------------------------------------------------------------------

interface Preflight {
  blockers: string[];
  client?: SupabaseClient;
}

/** A run id given as the additional-run authorization, or undefined. */
function authorizationFrom(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : undefined;
}

function importCommand(authorizeRunId?: string): string {
  return (
    `npm run catalog:import -- --confirm ${START_CONFIRMATION}` +
    (authorizeRunId ? ` --authorize-additional-paid-run ${authorizeRunId}` : "")
  );
}

async function preflight(options: {
  forStart: boolean;
  /** The id of the earlier paid (or possibly paid) run this start supersedes. */
  authorizeAdditionalPaidRun?: string;
}): Promise<Preflight> {
  const blockers: string[] = [];

  if (!hasBrightDataToken()) blockers.push("BRIGHT_DATA_API_TOKEN is not set on the server.");
  const configuredDataset = process.env.BRIGHT_DATA_DATASET_ID?.trim();
  if (configuredDataset && configuredDataset !== AUTHORIZED_DATASET_ID) {
    blockers.push(
      `BRIGHT_DATA_DATASET_ID is not the authorized dataset (${AUTHORIZED_DATASET_ID}); nothing will be sent to another dataset.`,
    );
  }

  const { client, problem } = serviceClient();
  if (!client) {
    blockers.push(problem ?? "Supabase is not configured.");
    return { blockers };
  }

  let migrated = true;
  for (const table of CATALOG_TABLES) {
    const { error } = await client.from(table).select("id").limit(1);
    if (!error) continue;
    migrated = false;
    blockers.push(
      isMissingRelation(error)
        ? `Table ${table} does not exist. Apply supabase/migrations/0005_catalog.sql in the Supabase SQL Editor first.`
        : `Could not read ${table} (${error.code || "unknown error"}).`,
    );
  }
  if (!migrated || !options.forStart) return { blockers, client };

  const active = await client
    .from("catalog_sync_runs")
    .select("id, status")
    .eq("source", CATALOG_SOURCE)
    .in("status", [...ACTIVE_STATUSES])
    .limit(1);
  if (active.error) {
    blockers.push(`Could not check for runs in progress (${active.error.code || "unknown error"}).`);
  } else if (active.data.length > 0) {
    const run = active.data[0] as { id: string; status: string };
    blockers.push(`Run ${run.id} is still ${run.status}. Continue it with: ${resumeCommand(run.id)}`);
  }

  // The most recent run Bright Data accepted, or may have. Another paid
  // request is allowed only when the caller names exactly that run.
  const paid = await client
    .from("catalog_sync_runs")
    .select("id, status, trigger_state")
    .eq("source", CATALOG_SOURCE)
    .in("trigger_state", [...PAID_TRIGGER_STATES])
    .order("started_at", { ascending: false })
    .limit(1);
  if (paid.error) {
    blockers.push(`Could not check earlier paid runs (${paid.error.code || "unknown error"}).`);
  } else if (paid.data.length > 0) {
    const run = paid.data[0] as { id: string; status: string; trigger_state: string };
    if (options.authorizeAdditionalPaidRun !== run.id.toLowerCase()) {
      blockers.push(
        run.trigger_state === "accepted"
          ? `The authorized collection has already been started (run ${run.id}, ${run.status}). ` +
              `Resume or re-import it with: ${resumeCommand(run.id)}. ` +
              `A second paid collection must name that run: ${importCommand(run.id)}`
          : `Run ${run.id} may have reached Bright Data (its outcome is unknown). Check the Bright Data ` +
              "dashboard for a snapshot or charge from it before sending another paid request. " +
              `To send one anyway, name that run: ${importCommand(run.id)}`,
      );
    }
  }

  return { blockers, client };
}

// ---------------------------------------------------------------------------
// output fields
// ---------------------------------------------------------------------------

interface FieldCheck {
  datasetFields: DatasetField[];
  confirmed: string[];
  notInSchema: string[];
  inactive: string[];
}

/** Compares the fields the trigger will request with the dataset's own
 *  schema. One free metadata read; no collection is started. */
async function checkOutputFields(): Promise<FieldCheck> {
  const datasetFields = await fetchDatasetFields(AUTHORIZED_DATASET_ID);
  const byName = new Map(datasetFields.map((field) => [field.name, field]));
  const confirmed: string[] = [];
  const notInSchema: string[] = [];
  const inactive: string[] = [];
  for (const name of OUTPUT_FIELDS) {
    const field = byName.get(name);
    if (!field) notInSchema.push(name);
    else if (field.active === false) inactive.push(name);
    else confirmed.push(name);
  }
  return { datasetFields, confirmed, notInSchema, inactive };
}

export async function describeOutputFields(): Promise<ImportOutcome> {
  if (!hasBrightDataToken()) {
    return {
      httpStatus: 409,
      body: { action: "fields", externalRequestMade: false, blockers: ["BRIGHT_DATA_API_TOKEN is not set on the server."] },
    };
  }
  try {
    const check = await checkOutputFields();
    return {
      httpStatus: 200,
      body: {
        action: "fields",
        externalRequestMade: true,
        collectionStarted: false,
        metadataEndpoint: datasetMetadataUrl(AUTHORIZED_DATASET_ID),
        datasetId: AUTHORIZED_DATASET_ID,
        datasetFieldCount: check.datasetFields.length,
        datasetFields: check.datasetFields,
        requestedFields: OUTPUT_FIELDS,
        confirmed: check.confirmed,
        notInSchema: check.notInSchema,
        inactive: check.inactive,
        allRequestedFieldsConfirmed: check.notInSchema.length === 0 && check.inactive.length === 0,
      },
    };
  } catch (cause) {
    if (!(cause instanceof BrightDataError)) throw cause;
    return {
      httpStatus: 502,
      body: {
        action: "fields",
        externalRequestMade: cause.code !== "token_missing",
        collectionStarted: false,
        error: `bright_data_${cause.code}`,
        upstreamStatus: cause.httpStatus ?? null,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------------

export async function previewImport(
  input: { authorizeAdditionalPaidRun?: unknown } = {},
): Promise<ImportOutcome> {
  const authorizeRunId = authorizationFrom(input.authorizeAdditionalPaidRun);
  const { blockers } = await preflight({ forStart: true, authorizeAdditionalPaidRun: authorizeRunId });
  return {
    httpStatus: 200,
    body: {
      action: "preview",
      externalRequestMade: false,
      readyToStart: blockers.length === 0,
      blockers,
      additionalPaidRunAuthorizedFor: authorizeRunId ?? null,
      request: describeTriggerRequest(),
      requestedFields: OUTPUT_FIELDS,
      limits: {
        keywords: IMPORT_KEYWORDS.length,
        recordsPerKeyword: LIMIT_PER_KEYWORD,
        maxRecords: MAX_RECORDS,
      },
      checkBeforeTrigger: `GET ${datasetMetadataUrl(AUTHORIZED_DATASET_ID)} — start verifies every requested field exists; free, starts nothing.`,
      followUpRequests: [
        `GET ${BRIGHT_DATA_API_BASE}/progress/{snapshot_id} — collection status; starts nothing.`,
        `GET ${BRIGHT_DATA_API_BASE}/snapshot/{snapshot_id}?format=json — downloads the collected records.`,
      ],
      assumptions: IMPORT_ASSUMPTIONS,
      startWith: importCommand(authorizeRunId),
    },
  };
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

async function updateRun(
  client: SupabaseClient,
  runId: string,
  changes: Record<string, unknown>,
): Promise<PostgrestError | null> {
  const { error } = await client.from("catalog_sync_runs").update(changes).eq("id", runId);
  return error;
}

export async function startImport(input: {
  confirm?: unknown;
  authorizeAdditionalPaidRun?: unknown;
}): Promise<ImportOutcome> {
  if (input.confirm !== START_CONFIRMATION) {
    return {
      httpStatus: 400,
      body: {
        action: "start",
        paidRequestSent: false,
        error: "confirmation_required",
        message: `Send "confirm": "${START_CONFIRMATION}" to start the paid collection.`,
      },
    };
  }

  if (input.authorizeAdditionalPaidRun !== undefined && !authorizationFrom(input.authorizeAdditionalPaidRun)) {
    return {
      httpStatus: 400,
      body: {
        action: "start",
        paidRequestSent: false,
        error: "invalid_authorization",
        message: "authorizeAdditionalPaidRun must be the id of the earlier run being superseded.",
      },
    };
  }
  const check = await preflight({
    forStart: true,
    authorizeAdditionalPaidRun: authorizationFrom(input.authorizeAdditionalPaidRun),
  });
  if (check.blockers.length > 0 || !check.client) {
    return {
      httpStatus: 409,
      body: { action: "start", paidRequestSent: false, blockers: check.blockers },
    };
  }
  const client = check.client;

  // 0. Confirm every requested output field exists in the dataset's schema.
  //    One free metadata read; a mismatch stops here, before a run is even
  //    recorded, so an invalid field list can never reach the paid endpoint.
  let fields: FieldCheck;
  try {
    fields = await checkOutputFields();
  } catch (cause) {
    if (!(cause instanceof BrightDataError)) throw cause;
    return {
      httpStatus: 502,
      body: {
        action: "start",
        paidRequestSent: false,
        error: `bright_data_${cause.code}`,
        upstreamStatus: cause.httpStatus ?? null,
        blockers: ["Could not read the dataset metadata to verify the requested fields, so nothing paid was sent."],
      },
    };
  }
  if (fields.notInSchema.length > 0 || fields.inactive.length > 0) {
    return {
      httpStatus: 409,
      body: {
        action: "start",
        paidRequestSent: false,
        blockers: [
          `Requested fields not available in the dataset schema: ${[...fields.notInSchema, ...fields.inactive].join(", ")}. Nothing paid was sent.`,
        ],
      },
    };
  }

  // 1. Record the run before anything is sent. The row's constraints hold
  //    the authorized limits, and the one-active-run index turns a second
  //    concurrent start into a conflict here instead of a second collection.
  const inserted = await client
    .from("catalog_sync_runs")
    .insert({
      source: CATALOG_SOURCE,
      status: "pending",
      trigger_state: "not_sent",
      dataset_id: AUTHORIZED_DATASET_ID,
      keywords: IMPORT_KEYWORDS.map((target) => target.keyword),
      limit_per_keyword: LIMIT_PER_KEYWORD,
      max_records: MAX_RECORDS,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    const conflict = inserted.error?.code === "23505";
    return {
      httpStatus: conflict ? 409 : 500,
      body: {
        action: "start",
        paidRequestSent: false,
        error: conflict ? "run_in_progress" : "run_record_failed",
        message: conflict
          ? "Another import run is already in progress."
          : `Could not record the run (${inserted.error?.code || "unknown error"}), so nothing was sent.`,
      },
    };
  }
  const runId = (inserted.data as { id: string }).id;

  // 2. From here the request may leave this process. Mark it so first: if the
  //    server dies mid-request, the row says "unknown", which blocks another
  //    paid run until a person has checked.
  const marked = await updateRun(client, runId, { trigger_state: "unknown" });
  if (marked) {
    await updateRun(client, runId, { status: "failed", trigger_state: "not_sent", error_code: "run_record_failed" });
    return {
      httpStatus: 500,
      body: {
        action: "start",
        runId,
        paidRequestSent: false,
        error: "run_record_failed",
        message: "Could not update the run record, so nothing was sent.",
      },
    };
  }

  // 3. The one paid request.
  let snapshotId: string;
  try {
    ({ snapshotId } = await triggerKeywordDiscovery(AUTHORIZED_DATASET_ID));
  } catch (cause) {
    if (!(cause instanceof BrightDataError)) throw cause;
    const triggerState = cause.accepted === "no" ? "rejected" : "unknown";
    await updateRun(client, runId, {
      status: "failed",
      trigger_state: triggerState,
      error_code: `bright_data_${cause.code}`,
      finished_at: new Date().toISOString(),
    });
    return {
      httpStatus: 502,
      body: {
        action: "start",
        runId,
        paidRequestSent: cause.code !== "token_missing",
        status: "failed",
        triggerState,
        error: `bright_data_${cause.code}`,
        upstreamStatus: cause.httpStatus ?? null,
        message:
          triggerState === "rejected"
            ? "Bright Data refused the request, so nothing was collected. The server log names the reason."
            : "The request may have reached Bright Data. Check the Bright Data dashboard before sending another; " +
              `a second paid request must name this run: ${importCommand(runId)}`,
      },
    };
  }

  // 4. Keep the snapshot id. Retried, because losing it would strand a paid
  //    collection; it is also returned and logged (it is not a secret), so it
  //    can be attached by hand with resume if the database stays unreachable.
  const accepted = {
    status: "collecting",
    trigger_state: "accepted",
    snapshot_id: snapshotId,
    triggered_at: new Date().toISOString(),
  };
  let saveError = await updateRun(client, runId, accepted);
  for (let attempt = 0; saveError && attempt < 2; attempt += 1) {
    saveError = await updateRun(client, runId, accepted);
  }
  if (saveError) {
    console.error(
      `[catalog-import] run ${runId} was accepted as snapshot ${snapshotId} but could not be recorded (${saveError.code}).`,
    );
  }

  return {
    httpStatus: 202,
    body: {
      action: "start",
      runId,
      paidRequestSent: true,
      outputFieldsVerified: fields.confirmed.length,
      status: "collecting",
      snapshotId,
      snapshotRecorded: !saveError,
      request: describeTriggerRequest(),
      next: saveError
        ? `Record the snapshot with: ${resumeCommand(runId)} --snapshot ${snapshotId}`
        : `Bright Data is collecting. Continue with: ${resumeCommand(runId)}`,
    },
  };
}

// ---------------------------------------------------------------------------
// resume
// ---------------------------------------------------------------------------

function storedSummary(run: RunRow): Record<string, unknown> {
  return {
    action: "resume",
    runId: run.id,
    status: run.status,
    fetched: run.fetched_count,
    imported: run.imported_count,
    updated: run.updated_count,
    skipped: run.skipped_count,
    failed: run.failed_count,
    skipReasons: run.skip_reasons,
    failureCodes: run.failure_codes,
    typeCounts: run.keyword_counts,
    fieldCoverage: run.field_coverage,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
  };
}

function rpcArguments(product: NormalizedProduct) {
  return {
    p_product: {
      slug: product.slug,
      source: CATALOG_SOURCE,
      source_product_id: product.sourceProductId,
      source_url: product.sourceUrl,
      title: product.title,
      brand: product.brand,
      category: product.category,
      product_type: product.productType,
      description: product.description,
      price_cents: product.priceCents,
      list_price_cents: product.listPriceCents,
      currency: product.currency,
      rating: product.rating,
      rating_count: product.ratingCount,
      availability: product.availability,
      availability_text: product.availabilityText,
      image_url: product.imageUrl,
      source_categories: product.sourceCategories,
      discovery_keyword: product.discoveryKeyword,
      fetched_at: product.fetchedAt,
    },
    p_variants: product.variants.map((variant) => ({
      source_variant_id: variant.sourceVariantId,
      label: variant.label,
      options: variant.options,
      price_cents: variant.priceCents,
      currency: variant.currency,
      availability: variant.availability,
      is_default: variant.isDefault,
    })),
    p_specifications: product.specifications.map((spec) => ({
      kind: spec.kind,
      label: spec.label,
      value: spec.value,
    })),
  };
}

export async function resumeImport(input: {
  runId?: unknown;
  reimport?: unknown;
  snapshotId?: unknown;
}): Promise<ImportOutcome> {
  if (typeof input.runId !== "string" || !UUID.test(input.runId)) {
    return { httpStatus: 400, body: { action: "resume", error: "invalid_run_id", message: "runId must be a run's UUID." } };
  }
  const runId = input.runId;
  const reimport = input.reimport === true;

  const { client, problem } = serviceClient();
  if (!client) {
    return { httpStatus: 503, body: { action: "resume", error: "catalog_unconfigured", message: problem ?? "Supabase is not configured." } };
  }

  const loaded = await client.from("catalog_sync_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle();
  if (loaded.error) {
    return {
      httpStatus: isMissingRelation(loaded.error) ? 503 : 500,
      body: { action: "resume", error: "run_lookup_failed", message: `Could not read the run (${loaded.error.code || "unknown error"}).` },
    };
  }
  if (!loaded.data) return { httpStatus: 404, body: { action: "resume", error: "run_not_found" } };
  const run = loaded.data as unknown as RunRow;

  if ((run.status === "completed" || run.status === "completed_with_errors") && !reimport) {
    return { httpStatus: 200, body: { ...storedSummary(run), externalRequestMade: false, alreadyComplete: true } };
  }

  // Attaching a snapshot by hand is only for the one case that needs it: a
  // collection Bright Data accepted whose id could not be saved.
  let snapshotId = run.snapshot_id;
  if (!snapshotId) {
    if (run.trigger_state === "unknown" && isSnapshotId(input.snapshotId)) {
      snapshotId = input.snapshotId;
      const attached = await updateRun(client, runId, {
        snapshot_id: snapshotId,
        trigger_state: "accepted",
        status: "collecting",
        error_code: null,
      });
      if (attached) {
        return {
          httpStatus: attached.code === "23505" ? 409 : 500,
          body: { action: "resume", runId, error: "run_record_failed", message: `Could not attach the snapshot (${attached.code || "unknown error"}).` },
        };
      }
    } else {
      return {
        httpStatus: 409,
        body: {
          action: "resume",
          runId,
          error: "no_snapshot",
          message:
            run.trigger_state === "rejected" || run.trigger_state === "not_sent"
              ? "This run never started a collection, so there is nothing to resume."
              : "This run has no recorded snapshot. If Bright Data shows one for it, pass it with --snapshot.",
        },
      };
    }
  }

  // Progress first: a cheap status call, and it tells a failed collection
  // apart from one that is still running.
  let progress: SnapshotStatus;
  try {
    progress = await getSnapshotStatus(snapshotId);
  } catch (cause) {
    if (!(cause instanceof BrightDataError)) throw cause;
    return {
      httpStatus: 502,
      body: { action: "resume", runId, error: `bright_data_${cause.code}`, upstreamStatus: cause.httpStatus ?? null, retryable: true },
    };
  }

  if (progress === "failed" || progress === "canceled") {
    await updateRun(client, runId, { status: "failed", error_code: `collection_${progress}`, finished_at: new Date().toISOString() });
    return { httpStatus: 502, body: { action: "resume", runId, status: "failed", error: `collection_${progress}` } };
  }
  if (progress !== "ready") {
    return { httpStatus: 202, body: { action: "resume", runId, status: "collecting", brightDataStatus: progress } };
  }

  let download: SnapshotDownload;
  try {
    download = await downloadSnapshot(snapshotId);
  } catch (cause) {
    if (!(cause instanceof BrightDataError)) throw cause;
    if (cause.code === "snapshot_expired") {
      await updateRun(client, runId, { status: "failed", error_code: "bright_data_snapshot_expired", finished_at: new Date().toISOString() });
    }
    return {
      httpStatus: 502,
      body: {
        action: "resume",
        runId,
        error: `bright_data_${cause.code}`,
        upstreamStatus: cause.httpStatus ?? null,
        retryable: cause.code !== "snapshot_expired",
      },
    };
  }
  if (!download.ready) {
    return { httpStatus: 202, body: { action: "resume", runId, status: "collecting", brightDataStatus: "building" } };
  }

  const marked = await updateRun(client, runId, { status: "importing", error_code: null });
  if (marked) {
    return {
      httpStatus: marked.code === "23505" ? 409 : 500,
      body: {
        action: "resume",
        runId,
        error: marked.code === "23505" ? "run_in_progress" : "run_record_failed",
        message: `Could not mark the run as importing (${marked.code || "unknown error"}); nothing was written.`,
      },
    };
  }

  const batch = normalizeSnapshot(download.records, new Date());

  let imported = 0;
  let updated = 0;
  let failed = 0;
  const failureCodes: Record<string, number> = {};
  const saved: {
    slug: string;
    title: string;
    category: string;
    productType: string;
    priceCents: number;
    result: "inserted" | "updated";
  }[] = [];

  for (const product of batch.products) {
    const { data, error } = await client.rpc("upsert_catalog_product", rpcArguments(product));
    if (error) {
      failed += 1;
      const code = error.code || "unknown";
      failureCodes[code] = (failureCodes[code] ?? 0) + 1;
      console.warn(
        `[catalog-import] could not save ${product.sourceProductId}: ${code} ${error.message.slice(0, 200)}`,
      );
      continue;
    }
    const result = data as { slug?: string; inserted?: boolean } | null;
    if (result?.inserted) imported += 1;
    else updated += 1;
    saved.push({
      slug: result?.slug ?? product.slug,
      title: product.title,
      category: product.category,
      productType: product.productType,
      priceCents: product.priceCents,
      result: result?.inserted ? "inserted" : "updated",
    });
  }

  const status = failed > 0 ? "completed_with_errors" : "completed";
  const finishedAt = new Date().toISOString();
  const finished = await updateRun(client, runId, {
    status,
    fetched_count: batch.fetched,
    imported_count: imported,
    updated_count: updated,
    skipped_count: batch.skipped,
    failed_count: failed,
    skip_reasons: batch.skipReasons,
    failure_codes: failureCodes,
    keyword_counts: batch.typeCounts,
    field_coverage: batch.coverage,
    error_code: null,
    finished_at: finishedAt,
  });
  if (finished) {
    console.warn(`[catalog-import] run ${runId} imported but its summary could not be saved (${finished.code}).`);
  }

  return {
    httpStatus: 200,
    body: {
      action: "resume",
      runId,
      externalRequestMade: true,
      status,
      reimport,
      fetched: batch.fetched,
      imported,
      updated,
      skipped: batch.skipped,
      failed,
      skipReasons: batch.skipReasons,
      failureCodes,
      typeCounts: batch.typeCounts,
      fieldCoverage: batch.coverage,
      summarySaved: !finished,
      products: saved,
      finishedAt,
    },
  };
}
