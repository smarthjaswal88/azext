/**
 * Model choice and cost arithmetic.
 *
 * Model: `deepseek-flash` — the non-reasoning chat model, and the cheaper of
 * the two DeepSeek offers. Reasoning is additionally switched off explicitly in
 * the request body rather than relied on by default.
 *
 * Prices below are the PEAK (more expensive) tier from DeepSeek's published
 * pricing, per 1M tokens. Using peak rates for estimates means the budget is
 * enforced conservatively: off-peak calls cost about half what we reserve.
 *
 *   deepseek-flash   input cache-miss  $0.30 / 1M     output  $1.20 / 1M
 *
 * All arithmetic is in integer micro-dollars (1_000_000 = $1), matching the
 * integer-cents discipline used for prices elsewhere in this codebase.
 */

export const DEEPSEEK_MODEL = "deepseek-flash";
export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

/** Hard ceiling on generated tokens. Also the basis of the cost reservation. */
export const MAX_OUTPUT_TOKENS = 900;

const INPUT_USD_PER_MILLION = 0.3;
const OUTPUT_USD_PER_MILLION = 1.2;

/** micros = tokens x (USD per 1M tokens). */
export function costMicros(promptTokens: number, completionTokens: number): number {
  return Math.ceil(
    promptTokens * INPUT_USD_PER_MILLION + completionTokens * OUTPUT_USD_PER_MILLION,
  );
}

/** Deliberately pessimistic: 3 characters per token understates real tokens
 *  per character, so the estimate lands above the true cost. */
export function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export function reservationMicros(promptText: string): number {
  return costMicros(estimatePromptTokens(promptText), MAX_OUTPUT_TOKENS);
}

export function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}
