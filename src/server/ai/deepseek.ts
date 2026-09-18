/**
 * Minimal DeepSeek chat-completions client. Server only.
 *
 * Deliberate choices:
 *   - one attempt, no retries. A retry on a paid endpoint doubles the bill for
 *     a request the shopper did not make twice;
 *   - a hard timeout, so a hung connection cannot hold a budget reservation
 *     open indefinitely;
 *   - JSON output requested explicitly, and thinking explicitly disabled;
 *   - the API key is read at call time, sent in the Authorization header, and
 *     never logged, returned, or included in any error message.
 *
 * Every outcome reports how sure we are that the provider billed for it. Only
 * "not_sent" — a request that never left this process — is treated as free.
 * Anything else is charged against the budget, because assuming a failed call
 * was free is how a budget quietly stops being a budget.
 *
 * Docs: https://api-docs.deepseek.com/api/create-chat-completion
 *       https://api-docs.deepseek.com/guides/json_mode
 */

import {
  DEEPSEEK_ENDPOINT,
  DEEPSEEK_MODEL,
  MAX_OUTPUT_TOKENS,
} from "./pricing";

export const REQUEST_TIMEOUT_MS = 25_000;

export interface DeepSeekUsage {
  promptTokens?: number;
  completionTokens?: number;
}

/** How confident we are that DeepSeek charged for the attempt. */
export type BillingCertainty = "not_sent" | "uncertain" | "billed";

export type DeepSeekResult =
  | { status: "ok"; content: string; usage: DeepSeekUsage; finishReason?: string }
  | { status: "timeout" }
  | { status: "failed"; detail: string; billing: BillingCertainty };

export async function requestGuidanceCompletion(
  systemPrompt: string,
  userPayload: string,
): Promise<DeepSeekResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  // Nothing was sent, so nothing can have been charged. This is the only
  // outcome that releases a reservation.
  if (!apiKey) return { status: "failed", detail: "no api key", billing: "not_sent" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
        // Structured output, bounded length, low variance.
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        stream: false,
        // deepseek-flash DOES support thinking — the reasoning guide shows it
        // used with {"type": "enabled"} — so this is a real switch, not a
        // formality. Thinking tokens bill as output, which would blow through
        // the reservation. The API reference lists "enabled" and "disabled" as
        // the allowed values.
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      // A rejected request may still have generated and billed tokens — a
      // content filter, for instance, stops after generation. We cannot tell
      // from the status code, so this counts against the budget.
      return {
        status: "failed",
        detail: `provider returned ${response.status}`,
        billing: "uncertain",
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const finishReason = body.choices?.[0]?.finish_reason;
    const content = body.choices?.[0]?.message?.content;

    // The JSON output guide notes the API "may occasionally return empty
    // content". Tokens were still produced, so it is billed.
    if (typeof content !== "string" || content.length === 0) {
      return { status: "failed", detail: "empty completion", billing: "billed" };
    }

    // finish_reason "length" means the answer hit max_tokens, so the JSON is
    // cut off mid-string and will not parse. Billed in full.
    if (finishReason === "length") {
      return { status: "failed", detail: "output truncated", billing: "billed" };
    }

    return {
      status: "ok",
      content,
      finishReason,
      usage: {
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
      },
    };
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      // Aborted from our side. The provider may well have completed and billed
      // it, so the caller keeps the reservation.
      return { status: "timeout" };
    }
    return {
      status: "failed",
      // Never interpolate anything that could carry the key.
      detail: "network error",
      // A connection that dropped mid-flight may still have reached the
      // provider. Uncertain, so not free.
      billing: "uncertain",
    };
  } finally {
    clearTimeout(timer);
  }
}
