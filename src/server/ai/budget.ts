/**
 * Spend controls. Server only.
 *
 * Nothing here is best-effort: if any part of it is unavailable, live requests
 * stay off. An AI feature that keeps working when its budget check is broken is
 * exactly the failure mode worth preventing.
 *
 * Three independent gates, all of which must pass:
 *
 *   1. AI_LIVE_REQUESTS must be explicitly set to "enabled". Default is off, so
 *      a deployment never starts spending money by accident.
 *   2. DEEPSEEK_API_KEY must be present.
 *   3. Supabase must be configured, because the budget ledger and rate limits
 *      live there. Without persistence a restart would reset the budget, and an
 *      in-memory counter shared by nobody is not a budget.
 */

import { createHash } from "node:crypto";
import { getServiceClient } from "@/server/supabase";

export const MAX_REQUESTS_PER_HOUR = 6;
export const MAX_REQUESTS_PER_DAY = 20;

export type AiDisabledReason =
  | "not_enabled"
  | "missing_api_key"
  | "no_persistence"
  | "no_budget_row";

export interface AiAvailability {
  available: boolean;
  reason?: AiDisabledReason;
}

export function readAiAvailability(): AiAvailability {
  if (process.env.AI_LIVE_REQUESTS?.trim() !== "enabled") {
    return { available: false, reason: "not_enabled" };
  }
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    return { available: false, reason: "missing_api_key" };
  }
  if (!getServiceClient()) {
    return { available: false, reason: "no_persistence" };
  }
  return { available: true };
}

/**
 * Identifies a caller for rate limiting without storing anything about them.
 * The IP and user agent are hashed with a server-side salt and only the digest
 * is persisted, so the table cannot be used to identify a visitor later.
 */
export function visitorHash(request: Request): string {
  const salt = process.env.AI_VISITOR_SALT?.trim() ?? "azext-demo-default-salt";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${salt}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

export type BeginResult =
  | { status: "ok"; requestId: string }
  | { status: "budget_exhausted" }
  | { status: "rate_limited"; scope: string }
  | { status: "unavailable"; detail: string };

/** Reserves headroom for one call. Returns a request id that must be settled. */
export async function beginRequest(
  hash: string,
  model: string,
  estimateMicros: number,
  cacheKey: string,
): Promise<BeginResult> {
  const supabase = getServiceClient();
  if (!supabase) return { status: "unavailable", detail: "no persistence" };

  const { data, error } = await supabase.rpc("ai_begin_request", {
    p_visitor_hash: hash,
    p_model: model,
    p_estimate_micros: estimateMicros,
    p_cache_key: cacheKey,
    p_max_per_hour: MAX_REQUESTS_PER_HOUR,
    p_max_per_day: MAX_REQUESTS_PER_DAY,
  });

  if (error) return { status: "unavailable", detail: error.message };

  const result = data as { status?: string; request_id?: string; scope?: string } | null;
  switch (result?.status) {
    case "ok":
      return result.request_id
        ? { status: "ok", requestId: result.request_id }
        : { status: "unavailable", detail: "no request id returned" };
    case "budget_exhausted":
      return { status: "budget_exhausted" };
    case "rate_limited":
      return { status: "rate_limited", scope: result.scope ?? "window" };
    case "no_budget_configured":
      return { status: "unavailable", detail: "no budget row" };
    default:
      return { status: "unavailable", detail: "unexpected budget response" };
  }
}

/** Replaces the reservation with the real cost, or releases it when nothing was
 *  billed. Failing to settle leaves the reservation counting against the
 *  budget, which errs towards spending less. */
export async function settleRequest(
  requestId: string,
  state: "settled" | "released",
  actualMicros: number,
  promptTokens: number | undefined,
  completionTokens: number | undefined,
  outcome: string,
): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  await supabase.rpc("ai_settle_request", {
    p_request_id: requestId,
    p_state: state,
    p_actual_micros: actualMicros,
    p_prompt_tokens: promptTokens ?? null,
    p_completion_tokens: completionTokens ?? null,
    p_outcome: outcome,
  });
}

export async function readCache(cacheKey: string): Promise<unknown | undefined> {
  const supabase = getServiceClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from("ai_guidance_cache")
    .select("payload")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (error || !data) return undefined;
  return (data as { payload: unknown }).payload;
}

export async function writeCache(
  cacheKey: string,
  model: string,
  payload: unknown,
): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  await supabase
    .from("ai_guidance_cache")
    .upsert({ cache_key: cacheKey, model, payload }, { onConflict: "cache_key" });
}

/** Stable key across products, chosen variants, preference text, model and
 *  catalog version. Any change to any of those is a different question. */
export function buildCacheKey(input: {
  model: string;
  catalogVersion: string;
  items: { slug: string; variantId?: string }[];
  preferences: string;
}): string {
  const canonical = JSON.stringify({
    m: input.model,
    c: input.catalogVersion,
    i: input.items
      .map((i) => `${i.slug}:${i.variantId ?? ""}`)
      .slice()
      .sort(),
    p: input.preferences.trim().toLowerCase().replace(/\s+/g, " "),
  });
  return createHash("sha256").update(canonical).digest("hex");
}
