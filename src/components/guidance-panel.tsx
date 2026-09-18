"use client";

import { useRef, useState } from "react";
import {
  MAX_PREFERENCE_CHARS,
  type GuidanceError,
  type GuidanceProduct,
  type GuidanceResult,
} from "@/lib/guidance";
import { formatPrice } from "@/lib/format";
import type { CategoryId } from "@/lib/types";

export interface GuidanceItem {
  slug: string;
  title: string;
  colorId?: string;
  sizeId?: string;
}

const PLACEHOLDERS: Record<CategoryId, string> = {
  headphones: "Work calls, comfort, under $150.",
  clothing: "Office wear, relaxed fit, easy care.",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-in-stock/10 text-in-stock border-in-stock/30",
  medium: "bg-star/10 text-star border-star/30",
  low: "bg-surface-muted text-ink-muted border-border-strong",
  insufficient: "bg-surface-muted text-ink-muted border-border-strong",
};

type Phase =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; error: GuidanceError }
  | { state: "ready"; result: GuidanceResult; signature: string };

/**
 * Optional guidance. Nothing here runs on load, while typing, or when a variant
 * changes — DeepSeek is called only when "Help me choose" is pressed, because
 * every call costs money.
 *
 * A result is tied to the selection and preferences that produced it. Change
 * either and the result is marked out of date rather than silently reused, and
 * a slower earlier response can never overwrite a newer one.
 */
export function GuidancePanel({
  items,
  category,
  aiAvailable,
}: {
  items: GuidanceItem[];
  category: CategoryId;
  aiAvailable: boolean;
}) {
  const [preferences, setPreferences] = useState("");
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Monotonic counter: only the newest request may write a result.
  const attemptRef = useRef(0);
  const abortRef = useRef<AbortController | undefined>(undefined);

  const signature = JSON.stringify({
    items: items.map((i) => [i.slug, i.colorId ?? "", i.sizeId ?? ""]),
    p: preferences.trim().toLowerCase(),
  });

  const outdated = phase.state === "ready" && phase.signature !== signature;

  async function requestGuidance() {
    if (phase.state === "loading") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    const forSignature = signature;

    setPhase({ state: "loading" });

    try {
      const response = await fetch("/api/guidance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          items: items.map((i) => ({
            slug: i.slug,
            colorId: i.colorId,
            sizeId: i.sizeId,
          })),
          preferences: preferences.trim(),
        }),
      });

      const payload = (await response.json()) as GuidanceResult & Partial<GuidanceError>;

      // A response for a selection the shopper has moved on from is discarded.
      if (attempt !== attemptRef.current) return;

      if (!response.ok) {
        setPhase({
          state: "error",
          error: {
            error: payload.error ?? "upstream_failed",
            message: payload.message ?? "Guidance could not be generated.",
            retryable: payload.retryable ?? true,
          },
        });
        return;
      }

      setPhase({ state: "ready", result: payload, signature: forSignature });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      if (attempt !== attemptRef.current) return;
      setPhase({
        state: "error",
        error: {
          error: "upstream_failed",
          message: "The request did not complete.",
          retryable: true,
        },
      });
    }
  }

  const hasPreferences = preferences.trim().length > 0;

  return (
    <section
      aria-labelledby="guidance-heading"
      className="mt-4 rounded-lg border border-border-subtle bg-surface p-3 sm:p-4"
    >
      <h2 id="guidance-heading" className="text-base font-bold sm:text-lg">
        Help me choose
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Optional. Tell us what matters and we will read the review texts we hold for these
        products and explain how they differ.
      </p>

      <div className="mt-3 max-w-2xl">
        <label htmlFor="preferences" className="block text-sm font-semibold">
          What matters to you?
        </label>
        <textarea
          id="preferences"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value.slice(0, MAX_PREFERENCE_CHARS))}
          rows={2}
          placeholder={`For example: ${PLACEHOLDERS[category]}`}
          className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {hasPreferences
              ? "We will suggest a best fit, or say if nothing fits."
              : "Leave blank for a plain comparison with no personal recommendation."}
          </p>
          <p className="shrink-0 text-xs tabular-nums text-ink-muted">
            {preferences.length}/{MAX_PREFERENCE_CHARS}
          </p>
        </div>

        {aiAvailable ? (
          <button
            type="button"
            onClick={() => void requestGuidance()}
            disabled={phase.state === "loading"}
            className="mt-2.5 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-hover disabled:opacity-60"
          >
            {phase.state === "loading" ? "Reading the reviews…" : "Help me choose"}
          </button>
        ) : (
          <p className="mt-2.5 rounded-md border border-border-strong bg-surface-muted px-3 py-2 text-sm text-ink-muted">
            Guidance is unavailable in this deployment. The comparison above, and everything
            else in the store, works as normal.
          </p>
        )}
      </div>

      <p className="mt-3 max-w-prose rounded-md border border-border-subtle bg-surface-muted px-3 py-2 text-xs text-ink-muted">
        This catalog is a demo. Each product holds only three or four written review records,
        far fewer than the aggregate rating figures shown in the table. Any guidance is based
        on those few records alone.
      </p>

      {phase.state === "loading" && (
        <p role="status" className="mt-4 text-sm text-ink-muted">
          Reading the review texts for these products…
        </p>
      )}

      {phase.state === "error" && (
        <div role="alert" className="mt-4 rounded-md border border-sale/40 bg-surface p-3">
          <p className="text-sm font-semibold text-sale">{phase.error.message}</p>
          {phase.error.retryable && (
            <button
              type="button"
              onClick={() => void requestGuidance()}
              className="mt-2 rounded-full border border-border-strong bg-surface px-4 py-1.5 text-sm font-medium hover:bg-surface-muted"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {phase.state === "ready" && (
        <div className="mt-4">
          {outdated && (
            <p
              role="status"
              className="mb-3 rounded-md border border-star/40 bg-star/10 px-3 py-2 text-sm"
            >
              Your selection or preferences changed after this was written, so it is out of
              date. Press &ldquo;Help me choose&rdquo; again to refresh it.
            </p>
          )}

          {phase.result.suggestion && (
            <div className="mb-4 rounded-md border border-border-strong bg-surface-muted p-3">
              <h3 className="text-sm font-bold">
                {phase.result.suggestion.slug
                  ? `Suggested: ${
                      items.find((i) => i.slug === phase.result.suggestion?.slug)?.title ??
                      phase.result.suggestion.slug
                    }`
                  : "No clear match"}
              </h3>
              {phase.result.suggestion.reasons.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm">
                  {phase.result.suggestion.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              {phase.result.suggestion.tradeoffs.length > 0 && (
                <>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Tradeoffs
                  </p>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
                    {phase.result.suggestion.tradeoffs.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {phase.result.differences && phase.result.differences.length > 0 && (
            <div className="mb-4 rounded-md border border-border-strong bg-surface-muted p-3">
              <h3 className="text-sm font-bold">How these differ</h3>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm">
                {phase.result.differences.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-muted">
                No preferences were given, so no product is picked out as the best for you.
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {phase.result.products.map((product) => (
              <ProductGuidance
                key={product.slug}
                product={product}
                expanded={expanded[product.slug] ?? false}
                onToggle={() =>
                  setExpanded((prev) => ({ ...prev, [product.slug]: !prev[product.slug] }))
                }
              />
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-muted">
            Written by {phase.result.model}
            {phase.result.cached && " (reused from an identical earlier request)"}. Review
            confidence is calculated on our server from fixed rules, not by the model.
          </p>
        </div>
      )}
    </section>
  );
}

function ProductGuidance({
  product,
  expanded,
  onToggle,
}: {
  product: GuidanceProduct;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cited = product.analysedReviews.filter((r) => product.citedReviewIds.includes(r.id));

  return (
    <article className="rounded-md border border-border-subtle bg-surface p-3">
      <h3 className="line-clamp-2 text-sm font-semibold">{product.title}</h3>

      {/* Assessment one: evidence strength, computed on the server. */}
      <div className="mt-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Review confidence
        </p>
        <p
          className={`mt-1 inline-block rounded border px-2 py-0.5 text-xs font-bold ${
            CONFIDENCE_STYLES[product.confidence.level] ?? CONFIDENCE_STYLES.low
          }`}
        >
          {product.confidence.label}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{product.confidence.reason}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          How far the available review evidence supports any conclusion — not a measure of
          quality.
        </p>
      </div>

      {/* Assessment two: suitability, written by the model. */}
      <div className="mt-3 border-t border-border-subtle pt-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Match for your needs
        </p>
        <p className="mt-1 text-sm leading-relaxed">{product.matchSummary}</p>

        {product.budget && (
          <p className="mt-1.5 text-xs">
            <span className={product.budget.withinBudget ? "text-in-stock" : "text-sale"}>
              {product.budget.withinBudget ? "Within" : "Over"} your{" "}
              {formatPrice(product.budget.limitCents)} budget
            </span>
            <span className="text-ink-muted">
              {" "}
              at {formatPrice(product.budget.priceCents)}
              {product.budget.provisional && " (provisional — no size chosen yet)"}
            </span>
          </p>
        )}

        {product.priceProvisional && !product.budget && (
          <p className="mt-1.5 text-xs text-ink-muted">
            No size chosen, so the price is indicative rather than confirmed.
          </p>
        )}

        {product.tradeoffs.length > 0 && (
          <>
            <p className="mt-2 text-xs font-semibold text-ink-muted">Tradeoffs</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
              {product.tradeoffs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        )}

        {product.unknowns.length > 0 && (
          <>
            <p className="mt-2 text-xs font-semibold text-ink-muted">The reviews cannot tell us</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
              {product.unknowns.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* The evidence itself, so a claim can be checked rather than taken. */}
      <div className="mt-3 border-t border-border-subtle pt-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="text-xs font-medium text-ink-link hover:underline"
        >
          {expanded ? "Hide" : "Show"} the {product.analysedReviews.length} review text
          {product.analysedReviews.length === 1 ? "" : "s"} used
          {cited.length > 0 && ` (${cited.length} cited)`}
        </button>

        {expanded && (
          <ul className="mt-2 space-y-2">
            {product.analysedReviews.map((review) => {
              const wasCited = product.citedReviewIds.includes(review.id);
              return (
                <li
                  key={review.id}
                  className={`rounded border p-2 text-xs ${
                    wasCited ? "border-accent-ring bg-surface-muted" : "border-border-subtle"
                  }`}
                >
                  <p className="font-semibold">
                    {review.rating}★ {review.title}
                    {wasCited && (
                      <span className="ml-1.5 font-normal text-ink-muted">· cited</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-ink-muted">{review.excerpt}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {review.variantLabel ? `${review.variantLabel} · ` : ""}
                    {review.verifiedPurchase ? "Verified purchase" : "Unverified"} ·{" "}
                    <span className="font-mono">{review.id}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
