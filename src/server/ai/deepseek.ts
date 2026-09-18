/**
 * Minimal DeepSeek chat-completions client. Server only.
 *
 * Deliberate choices:
 *   - one attempt, no retries. A retry on a paid endpoint doubles the bill for
 *     a request the shopper did not make twice;
 *   - a hard timeout, so a hung connection cannot hold a budget reservation
 *     open indefinitely;
 *   - JSON output requested explicitly, and reasoning explicitly disabled;
 *   - the API key is read at call time, sent in the Authorization header, and
 *     never logged, returned, or included in any error message.
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

export type DeepSeekResult =
  | { status: "ok"; content: string; usage: DeepSeekUsage; finishReason?: string }
  | { status: "timeout" }
  | { status: "failed"; detail: string; billed: boolean };

export async function requestGuidanceCompletion(
  systemPrompt: string,
  userPayload: string,
): Promise<DeepSeekResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return { status: "failed", detail: "no api key", billed: false };

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
        // The chosen model is the non-reasoning one; this switches thinking off
        // explicitly rather than depending on the default.
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      // A non-2xx may still have been billed (for example a content filter), so
      // the caller settles rather than releases unless we know otherwise.
      const billed = response.status >= 500 ? false : response.status !== 429;
      return {
        status: "failed",
        detail: `provider returned ${response.status}`,
        billed,
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return { status: "failed", detail: "empty completion", billed: true };
    }

    return {
      status: "ok",
      content,
      finishReason: body.choices?.[0]?.finish_reason,
      usage: {
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
      },
    };
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      // Aborted client-side; the provider may still have billed it.
      return { status: "timeout" };
    }
    return {
      status: "failed",
      // Never interpolate anything that could carry the key.
      detail: "network error",
      billed: false,
    };
  } finally {
    clearTimeout(timer);
  }
}
