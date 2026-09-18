/**
 * Model choice and cost arithmetic.
 *
 * Checked against DeepSeek's own documentation, without calling the inference
 * API. Sources:
 *   pricing        https://api-docs.deepseek.com/quick_start/pricing
 *   chat API       https://api-docs.deepseek.com/api/create-chat-completion
 *   JSON output    https://api-docs.deepseek.com/guides/json_mode
 *   thinking mode  https://api-docs.deepseek.com/guides/reasoning_model
 *   token counting https://api-docs.deepseek.com/quick_start/token_usage
 *
 * MODEL: `deepseek-flash`, the cheaper of the two published models. An earlier
 * comment in this file described it as "the non-reasoning model". That was
 * wrong: the reasoning guide shows `deepseek-flash` being used with
 * `thinking: {"type": "enabled"}`, so it does support thinking and simply does
 * not use it unless asked. Reasoning is therefore something we must switch off
 * deliberately, which is what the request body does — not something the model
 * lacks. Thinking tokens are billed as output, so leaving this to chance would
 * be a spending risk rather than a style preference.
 *
 * PRICES, per 1M tokens, quoted from the pricing page:
 *
 *                     input (cache miss)      input (cache hit)     output
 *   deepseek-flash    off-peak $0.15          off-peak $0.003       off-peak $0.60
 *                     peak     $0.30          peak     $0.006       peak     $1.20
 *
 * Peak is 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday. We always reserve
 * at PEAK, cache-miss rates: the expensive case. An off-peak call then costs
 * about half what was set aside, which is the direction an estimate should err.
 *
 * All arithmetic is in integer micro-dollars (1_000_000 = $1), matching the
 * integer-cents discipline used for prices elsewhere in this codebase.
 */

export const DEEPSEEK_MODEL = "deepseek-flash";
export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

/** Hard ceiling on generated tokens, and the output half of every reservation.
 *  The JSON output guide warns that too small a value truncates the JSON
 *  mid-string, so this has to be comfortably above a full response. */
export const MAX_OUTPUT_TOKENS = 900;

const INPUT_USD_PER_MILLION_PEAK = 0.3;
const OUTPUT_USD_PER_MILLION_PEAK = 1.2;

/** Extra headroom on the input estimate. Covers tokenizer variance, and the
 *  possibility that a future prompt tweak lands between estimating and
 *  sending. */
const INPUT_SAFETY_FACTOR = 1.3;

/** micros = tokens x (USD per 1M tokens). */
export function costMicros(promptTokens: number, completionTokens: number): number {
  return Math.ceil(
    promptTokens * INPUT_USD_PER_MILLION_PEAK +
      completionTokens * OUTPUT_USD_PER_MILLION_PEAK,
  );
}

/**
 * Conservative token estimate for a prompt.
 *
 * DeepSeek documents "1 English character ≈ 0.3 token" and warns the real ratio
 * varies by model, recommending the usage figures returned by the API for
 * anything exact. We use 1/3 (0.333) rather than 0.3, then apply the safety
 * factor, so the estimate sits above the documented ratio rather than on it.
 */
export function estimatePromptTokens(text: string): number {
  return Math.ceil((text.length / 3) * INPUT_SAFETY_FACTOR);
}

/**
 * What to set aside before a call: the bounded input we are about to send,
 * over-estimated, plus the full output ceiling — never an expected output
 * length. A reservation that assumed a short answer would under-reserve exactly
 * when the model is most expensive.
 */
export function reservationMicros(promptText: string): number {
  return costMicros(estimatePromptTokens(promptText), MAX_OUTPUT_TOKENS);
}

export function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}
