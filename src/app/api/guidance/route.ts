import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  MAX_GUIDANCE_PRODUCTS,
  MAX_NEED_CHARS,
  MIN_NEED_CHARS,
  type GuidanceErrorCode,
  type GuidanceResult,
} from "@/lib/guidance";
import {
  beginRequest,
  buildCacheKey,
  readAiAvailability,
  readCache,
  settleRequest,
  visitorHash,
  writeCache,
} from "@/server/ai/budget";
import { buildGuidanceContext, modelPayload } from "@/server/ai/context";
import { requestGuidanceCompletion } from "@/server/ai/deepseek";
import { assembleResult, PROMPT_VERSION, SYSTEM_PROMPT, validateModelOutput } from "@/server/ai/guidance";
import { costMicros, DEEPSEEK_MODEL, reservationMicros } from "@/server/ai/pricing";
import type { CatalogProductDetail } from "@/lib/catalog-api";
import { CatalogReadError, getCatalogProductsByIdentifiers } from "@/server/catalog-db";

/** Refuses anything larger outright rather than parsing it. */
const MAX_BODY_BYTES = 8 * 1024;
const NO_STORE = { "cache-control": "no-store" };

function fail(status: number, error: GuidanceErrorCode, message: string, retryable: boolean) {
  return NextResponse.json({ error, message, retryable }, { status, headers: NO_STORE });
}

/** Live requests are possible only when every gate passes. A malformed
 *  Supabase URL makes the client constructor throw; that is "unavailable". */
function aiAvailable(): boolean {
  try {
    return readAiAvailability().available;
  } catch {
    return false;
  }
}

function parseBody(raw: unknown): { need: string; products: string[] } | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const body = raw as Record<string, unknown>;

  if (typeof body.need !== "string") return undefined;
  const need = body.need.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  if (need.length < MIN_NEED_CHARS || need.length > MAX_NEED_CHARS) return undefined;

  if (!Array.isArray(body.products) || body.products.length === 0) return undefined;
  if (body.products.length > MAX_GUIDANCE_PRODUCTS) return undefined;
  const products: string[] = [];
  for (const entry of body.products) {
    if (typeof entry !== "string" || entry.length === 0 || entry.length > 120) return undefined;
    if (!products.includes(entry)) products.push(entry);
  }
  return { need, products };
}

/** Whether the assistant can make live requests here. A boolean only: which
 *  requirement is missing is deployment detail and stays in the server. */
export async function GET() {
  return NextResponse.json({ available: aiAvailable() }, { headers: NO_STORE });
}

/**
 * Compares live catalog products against the shopper's stated need. Called
 * only when the shopper presses the button — never on load or while typing.
 *
 * Product facts are loaded from Supabase by slug or id. Nothing the browser
 * sends about a price, a specification or a rating is trusted or even read.
 */
export async function POST(request: Request) {
  // Gate 1, before anything else: no work at all happens while live requests
  // are off, so nothing downstream can reach the provider.
  if (!aiAvailable()) {
    return fail(503, "ai_disabled", "The decision assistant is switched off in this deployment.", false);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, "invalid_request", "That request was too large.", false);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(400, "invalid_request", "Malformed request.", false);
  }
  const parsed = parseBody(json);
  if (!parsed) {
    return fail(
      400,
      "invalid_request",
      `Describe what matters in ${MIN_NEED_CHARS}–${MAX_NEED_CHARS} characters, for 1 to ${MAX_GUIDANCE_PRODUCTS} products.`,
      false,
    );
  }

  // Everything below comes from the live catalog, keyed by the ids above.
  let products: CatalogProductDetail[];
  try {
    products = await getCatalogProductsByIdentifiers(parsed.products);
  } catch (cause) {
    if (cause instanceof CatalogReadError) {
      return fail(503, "catalog_unavailable", "The catalog could not be read. You can try again.", true);
    }
    throw cause;
  }
  if (products.length !== parsed.products.length) {
    return fail(400, "unknown_product", "One of the selected products is not in the catalog.", false);
  }
  // Refused rather than trimmed: a mixed set means the caller is not the UI,
  // and answering about a subset would spend money on a question nobody asked.
  if (new Set(products.map((p) => p.category)).size > 1) {
    return fail(400, "invalid_request", "Products can only be compared within one category.", false);
  }

  const context = buildGuidanceContext(products, parsed.need);
  const payload = modelPayload(context);

  // The fingerprint covers the exact evidence sent, the prompt version, the
  // model and the normalised need: a re-import that changes any listing, or a
  // prompt change, is a different question and is never answered from cache.
  const evidenceHash = createHash("sha256").update(payload).digest("hex");
  const cacheKey = buildCacheKey({
    model: DEEPSEEK_MODEL,
    catalogVersion: `${PROMPT_VERSION}:${evidenceHash}`,
    items: products.map((p) => ({ slug: p.slug })),
    preferences: parsed.need,
  });

  // A repeat of an identical question costs nothing. Cached output is
  // re-validated against today's catalog, and confidence recomputed.
  const cachedRaw = await readCache(cacheKey);
  if (cachedRaw) {
    const revalidated = validateModelOutput(cachedRaw, context);
    if (revalidated) {
      const result: GuidanceResult = assembleResult(revalidated, context, cacheKey, true);
      return NextResponse.json(result, { headers: NO_STORE });
    }
  }

  const estimate = reservationMicros(SYSTEM_PROMPT + payload);
  const begun = await beginRequest(visitorHash(request), DEEPSEEK_MODEL, estimate, cacheKey);
  if (begun.status === "budget_exhausted") {
    return fail(429, "budget_exhausted", "The decision assistant's budget for this demo has been used up.", false);
  }
  if (begun.status === "rate_limited") {
    return fail(429, "rate_limited", `Too many requests. Try again later (${begun.scope} limit).`, true);
  }
  if (begun.status === "duplicate_in_flight") {
    // An identical question is already being paid for; without this check two
    // simultaneous cache misses would both call the provider and both bill.
    return fail(409, "duplicate_in_flight", "The same question is already being answered. Try again in a moment.", true);
  }
  if (begun.status !== "ok") {
    return fail(503, "ai_disabled", "The decision assistant is unavailable right now.", false);
  }

  const completion = await requestGuidanceCompletion(SYSTEM_PROMPT, payload);

  if (completion.status === "timeout") {
    // We stopped waiting; the provider may well have finished and billed. The
    // full reservation stands rather than being released on an assumption.
    await settleRequest(begun.requestId, "settled", estimate, undefined, undefined, "timeout");
    return fail(504, "timeout", "That took too long. You can try again.", true);
  }

  if (completion.status === "failed") {
    // Only a request that never left this process is treated as free.
    const neverSent = completion.billing === "not_sent";
    await settleRequest(
      begun.requestId,
      neverSent ? "released" : "settled",
      neverSent ? 0 : estimate,
      undefined,
      undefined,
      completion.detail,
    );
    return fail(502, "upstream_failed", "The recommendation could not be generated. You can try again.", true);
  }

  const actual = costMicros(completion.usage.promptTokens ?? 0, completion.usage.completionTokens ?? 0);

  let modelJson: unknown;
  try {
    modelJson = JSON.parse(completion.content);
  } catch {
    modelJson = undefined;
  }

  const validated = validateModelOutput(modelJson, context);
  if (!validated) {
    await settleRequest(
      begun.requestId,
      "settled",
      actual || estimate,
      completion.usage.promptTokens,
      completion.usage.completionTokens,
      "invalid_output",
    );
    return fail(502, "invalid_model_output", "The answer came back in an unusable form. You can try again.", true);
  }

  await settleRequest(
    begun.requestId,
    "settled",
    actual || estimate,
    completion.usage.promptTokens,
    completion.usage.completionTokens,
    "ok",
  );

  // Only validated output is cached, so a bad generation is never replayed.
  await writeCache(cacheKey, DEEPSEEK_MODEL, validated);

  const result: GuidanceResult = assembleResult(validated, context, cacheKey, false);
  return NextResponse.json(result, { headers: NO_STORE });
}
