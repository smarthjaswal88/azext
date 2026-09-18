import { NextResponse } from "next/server";
import {
  MAX_GUIDANCE_PRODUCTS,
  MAX_PREFERENCE_CHARS,
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
import {
  assembleResult,
  buildUserPayload,
  parseBudgetCents,
  resolveColumn,
  SYSTEM_PROMPT,
  requestGuidanceCompletion,
  validateModelOutput,
  type GuidanceColumn,
} from "@/server/ai/guidance";
import { costMicros, DEEPSEEK_MODEL, reservationMicros } from "@/server/ai/pricing";
import { CATALOG_VERSION, getProductsBySlugs } from "@/server/catalog";

/** Refuses anything larger outright rather than parsing it. */
const MAX_BODY_BYTES = 8 * 1024;

interface RequestedItem {
  slug: string;
  colorId?: string;
  sizeId?: string;
}

function parseBody(raw: unknown):
  | { items: RequestedItem[]; preferences: string }
  | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const body = raw as Record<string, unknown>;

  if (!Array.isArray(body.items) || body.items.length === 0) return undefined;
  if (body.items.length > MAX_GUIDANCE_PRODUCTS) return undefined;

  const items: RequestedItem[] = [];
  for (const entry of body.items) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const item = entry as Record<string, unknown>;
    if (typeof item.slug !== "string" || item.slug.length === 0 || item.slug.length > 120) {
      return undefined;
    }
    items.push({
      slug: item.slug,
      colorId: typeof item.colorId === "string" ? item.colorId.slice(0, 60) : undefined,
      sizeId: typeof item.sizeId === "string" ? item.sizeId.slice(0, 60) : undefined,
    });
  }

  const preferencesRaw = body.preferences;
  if (preferencesRaw !== undefined && typeof preferencesRaw !== "string") return undefined;
  const preferences = (preferencesRaw ?? "").trim().slice(0, MAX_PREFERENCE_CHARS);

  return { items, preferences };
}

/**
 * Produces comparison guidance. Called only when the shopper presses
 * "Help me choose" — never on load, on typing, or on a variant change.
 *
 * Product facts are loaded from the catalog by id. Nothing the browser sends
 * about a price, a specification or a review is trusted or even read.
 */
export async function POST(request: Request) {
  const availability = readAiAvailability();
  if (!availability.available) {
    // The reason is a coarse code, never configuration detail.
    return NextResponse.json(
      {
        error: "ai_disabled",
        message: "Guidance is unavailable right now.",
        retryable: false,
      },
      { status: 503 },
    );
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "invalid_request", message: "That request was too large.", retryable: false },
      { status: 413 },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Malformed request.", retryable: false },
      { status: 400 },
    );
  }

  const parsed = parseBody(parsedJson);
  if (!parsed) {
    return NextResponse.json(
      { error: "invalid_request", message: "Malformed request.", retryable: false },
      { status: 400 },
    );
  }

  // Everything below comes from the catalog, keyed by the ids above.
  const products = await getProductsBySlugs(parsed.items.map((i) => i.slug));
  if (products.length < 2) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "At least two known products are needed.",
        retryable: false,
      },
      { status: 400 },
    );
  }
  const category = products[0].category;
  const sameCategory = products.filter((p) => p.category === category);

  const columns: GuidanceColumn[] = sameCategory.map((product) => {
    const requested = parsed.items.find((i) => i.slug === product.slug);
    return resolveColumn(product, requested?.colorId, requested?.sizeId);
  });

  const budgetCents = parsed.preferences ? parseBudgetCents(parsed.preferences) : undefined;
  const cacheKey = buildCacheKey({
    model: DEEPSEEK_MODEL,
    catalogVersion: CATALOG_VERSION,
    items: columns.map((c) => ({ slug: c.product.slug, variantId: c.variant?.id })),
    preferences: parsed.preferences,
  });

  // A repeat of an identical question costs nothing.
  const cachedRaw = await readCache(cacheKey);
  if (cachedRaw) {
    const revalidated = validateModelOutput(cachedRaw, columns, Boolean(parsed.preferences));
    if (revalidated) {
      const result: GuidanceResult = assembleResult(
        revalidated,
        columns,
        budgetCents,
        cacheKey,
        true,
      );
      return NextResponse.json(result);
    }
  }

  const userPayload = buildUserPayload(columns, parsed.preferences, budgetCents);
  const estimate = reservationMicros(SYSTEM_PROMPT + userPayload);

  const begun = await beginRequest(visitorHash(request), DEEPSEEK_MODEL, estimate, cacheKey);
  if (begun.status === "budget_exhausted") {
    return NextResponse.json(
      {
        error: "budget_exhausted",
        message: "The guidance budget for this demo has been used up.",
        retryable: false,
      },
      { status: 429 },
    );
  }
  if (begun.status === "rate_limited") {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many guidance requests. Try again later (${begun.scope} limit).`,
        retryable: true,
      },
      { status: 429 },
    );
  }
  if (begun.status !== "ok") {
    return NextResponse.json(
      { error: "ai_disabled", message: "Guidance is unavailable right now.", retryable: false },
      { status: 503 },
    );
  }

  const completion = await requestGuidanceCompletion(SYSTEM_PROMPT, userPayload);

  if (completion.status === "timeout") {
    // Conservative: the provider may have billed it, so the reservation stands.
    await settleRequest(begun.requestId, "settled", estimate, undefined, undefined, "timeout");
    return NextResponse.json(
      { error: "timeout", message: "That took too long. You can try again.", retryable: true },
      { status: 504 },
    );
  }

  if (completion.status === "failed") {
    await settleRequest(
      begun.requestId,
      completion.billed ? "settled" : "released",
      completion.billed ? estimate : 0,
      undefined,
      undefined,
      completion.detail,
    );
    return NextResponse.json(
      {
        error: "upstream_failed",
        message: "Guidance could not be generated. You can try again.",
        retryable: true,
      },
      { status: 502 },
    );
  }

  const actual = costMicros(
    completion.usage.promptTokens ?? 0,
    completion.usage.completionTokens ?? 0,
  );

  let modelJson: unknown;
  try {
    modelJson = JSON.parse(completion.content);
  } catch {
    modelJson = undefined;
  }

  const validated = validateModelOutput(modelJson, columns, Boolean(parsed.preferences));
  if (!validated) {
    await settleRequest(
      begun.requestId,
      "settled",
      actual || estimate,
      completion.usage.promptTokens,
      completion.usage.completionTokens,
      "invalid_output",
    );
    return NextResponse.json(
      {
        error: "invalid_model_output",
        message: "The guidance came back in an unusable form. You can try again.",
        retryable: true,
      },
      { status: 502 },
    );
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
  await writeCache(cacheKey, DEEPSEEK_MODEL, {
    products: validated.products,
    suggestion: validated.suggestion,
    differences: validated.differences,
  });

  const result: GuidanceResult = assembleResult(
    validated,
    columns,
    budgetCents,
    cacheKey,
    false,
  );
  return NextResponse.json(result);
}
