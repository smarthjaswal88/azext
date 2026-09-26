"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CatalogProductDetail } from "@/lib/catalog-api";
import { shortName } from "@/lib/compare-insights";
import { formatPrice } from "@/lib/format";
import {
  CONFIDENCE_RULES,
  GUIDANCE_TRANSPARENCY_NOTE,
  MAX_NEED_CHARS,
  MIN_NEED_CHARS,
  type GuidanceAvailability,
  type GuidanceError,
  type GuidanceResult,
} from "@/lib/guidance";
import { AlertIcon, InfoIcon, SparkIcon } from "../icons";
import { PRODUCT_TONES } from "./compare-analysis";

/** Example needs, as UI copy, keyed by category id. */
const EXAMPLES: Record<string, string> = {
  headphones: "Comfortable headphones for the gym, under $100",
  clothing: "A breathable shirt for hot summer days, under $30",
};

const CONFIDENCE_BADGE = { high: "badge-positive", medium: "badge-caution", low: "badge" } as const;

type Availability = "checking" | "available" | "unavailable";

type Phase =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; error: GuidanceError }
  | { state: "ready"; result: GuidanceResult; signature: string };

/**
 * The decision assistant. Nothing here runs on load or while typing: a request
 * is made only when the button is pressed, and only when the server reports
 * that live requests are enabled. A result is tied to the products and need
 * that produced it; change either and it is marked out of date, and a slower
 * earlier response can never overwrite a newer one.
 */
export function DecisionAssistant({ products }: { products: CatalogProductDetail[] }) {
  const id = useId();
  const [availability, setAvailability] = useState<Availability>("checking");
  const [need, setNeed] = useState("");
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const attemptRef = useRef(0);
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/guidance", { signal: controller.signal, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<GuidanceAvailability>) : { available: false }))
      .then((body) => setAvailability(body.available ? "available" : "unavailable"))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setAvailability("unavailable");
      });
    return () => controller.abort();
  }, []);

  const slugs = products.map((p) => p.slug);
  const signature = JSON.stringify({ slugs, need: need.trim().toLowerCase() });
  const outdated = phase.state === "ready" && phase.signature !== signature;
  const trimmed = need.trim();
  const needOk = trimmed.length >= MIN_NEED_CHARS;
  const canAsk = availability === "available" && needOk && phase.state !== "loading";
  const example = EXAMPLES[products[0]?.category ?? ""] ?? "What matters most to you, and your budget";

  async function ask() {
    if (!canAsk) return;
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
        body: JSON.stringify({ need: trimmed, products: slugs }),
      });
      const payload = (await response.json()) as GuidanceResult & Partial<GuidanceError>;
      if (attempt !== attemptRef.current) return;
      if (!response.ok) {
        if (payload.error === "ai_disabled") setAvailability("unavailable");
        setPhase({
          state: "error",
          error: {
            error: payload.error ?? "upstream_failed",
            message: payload.message ?? "The recommendation could not be generated.",
            retryable: payload.retryable ?? true,
          },
        });
        return;
      }
      setPhase({ state: "ready", result: payload, signature: forSignature });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (attempt !== attemptRef.current) return;
      setPhase({
        state: "error",
        error: { error: "upstream_failed", message: "The request did not complete.", retryable: true },
      });
    }
  }

  const toneOf = (slug: string) => PRODUCT_TONES[Math.max(0, slugs.indexOf(slug))];
  const nameOf = (slug: string) => {
    const product = products.find((p) => p.slug === slug);
    return product ? shortName(product) : slug;
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="glass-strong glow relative overflow-hidden p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet/20 blur-3xl"
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-violet text-accent-ink">
              <SparkIcon size={20} />
            </span>
            <div>
              <p className="eyebrow">Decision assistant</p>
              <h2 id={`${id}-heading`} className="mt-1 text-xl font-semibold tracking-tight text-fg">
                Tell Nexus what matters to you
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-fg-muted">
                The assistant weighs these {products.length} products against your need, citing the
                exact listing fields it relied on.
              </p>
            </div>
          </div>
          <span className={`badge ${availability === "available" ? "badge-positive" : ""}`}>
            {availability === "checking" ? "Checking…" : availability === "available" ? "Available" : "Switched off"}
          </span>
        </div>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label htmlFor={`${id}-need`} className="text-sm font-medium text-fg">
            What matters to you?
          </label>
          <textarea
            id={`${id}-need`}
            value={need}
            onChange={(e) => setNeed(e.target.value.slice(0, MAX_NEED_CHARS))}
            rows={3}
            placeholder={`For example: ${example}`}
            aria-describedby={`${id}-help ${id}-transparency`}
            className="field mt-2 resize-y text-base leading-relaxed"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p id={`${id}-help`} className="text-xs text-fg-subtle">
              Mention use, must-haves and a budget, e.g. &ldquo;under $100&rdquo;. Budgets are checked
              in code, not by the AI.
            </p>
            <p className="text-xs tabular-nums text-fg-subtle">
              {need.length}/{MAX_NEED_CHARS}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!canAsk} className="btn btn-primary">
              <SparkIcon size={16} />
              {phase.state === "loading"
                ? "Weighing the products…"
                : availability === "unavailable"
                  ? "Assistant switched off"
                  : "Ask the decision assistant"}
            </button>
            {availability === "available" && !needOk && (
              <span className="text-xs text-fg-subtle">Describe your need to ask.</span>
            )}
          </div>
        </form>

        <p id={`${id}-transparency`} className="mt-4 flex gap-2 text-xs leading-relaxed text-fg-muted">
          <InfoIcon size={15} className="mt-px shrink-0 text-accent-strong" />
          {GUIDANCE_TRANSPARENCY_NOTE}
        </p>

        {availability === "unavailable" && (
          <div role="status" className="mt-5 rounded-2xl border border-line-strong bg-white/3 p-4">
            <p className="text-sm font-semibold text-fg">The decision assistant is switched off in this deployment</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              Nothing is sent while it is off — no AI request is made from this page, and no answer is
              shown in its place. The comparison above works without it.
            </p>
            <details className="mt-3 text-sm text-fg-muted">
              <summary className="cursor-pointer font-medium text-accent-strong">How the site owner turns it on</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  In the hosting provider&apos;s environment settings (on Vercel: Project → Settings →
                  Environment Variables), set <code className="font-mono text-fg">AI_LIVE_REQUESTS</code>{" "}
                  to <code className="font-mono text-fg">enabled</code>.
                </li>
                <li>
                  Add a server-only <code className="font-mono text-fg">DEEPSEEK_API_KEY</code>. It is never
                  sent to the browser.
                </li>
                <li>
                  Make sure the Supabase spend ledger exists (migrations <code className="font-mono">0003</code>{" "}
                  and <code className="font-mono">0004</code>), which enforces the budget, rate limits and
                  duplicate protection.
                </li>
                <li>Redeploy so the new settings take effect.</li>
              </ol>
            </details>
          </div>
        )}

        {phase.state === "loading" && (
          <p role="status" className="mt-5 text-sm text-fg-muted">
            Weighing the listings against your need…
          </p>
        )}

        {phase.state === "error" && availability !== "unavailable" && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-negative/30 bg-negative/10 p-4">
            <AlertIcon size={18} className="mt-0.5 shrink-0 text-negative" />
            <div>
              <p className="text-sm font-medium text-negative">{phase.error.message}</p>
              {phase.error.retryable && (
                <button type="button" onClick={() => void ask()} className="btn btn-secondary btn-sm mt-2">
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {phase.state === "ready" && (
          <div className="mt-6 space-y-5">
            {outdated && (
              <p role="status" className="rounded-2xl border border-caution/30 bg-caution/10 px-4 py-3 text-sm text-caution">
                Your products or your need changed after this was written, so it is out of date. Ask
                again to refresh it.
              </p>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div
                className={`rounded-2xl border bg-white/3 p-5 ${
                  phase.result.recommendation.slug ? toneOf(phase.result.recommendation.slug).ring : "border-line-strong"
                }`}
              >
                <p className="eyebrow">Recommendation</p>
                {phase.result.recommendation.slug ? (
                  <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-fg">
                    <span
                      aria-hidden="true"
                      className={`size-2.5 shrink-0 rounded-full ${toneOf(phase.result.recommendation.slug).dot}`}
                    />
                    {phase.result.recommendation.title}
                  </p>
                ) : (
                  <p className="mt-2 text-lg font-semibold text-fg">No clear recommendation</p>
                )}
                {phase.result.recommendation.reason && (
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{phase.result.recommendation.reason}</p>
                )}
              </div>

              <div className="rounded-2xl border border-line-strong bg-white/3 p-5">
                <p className="eyebrow">Confidence</p>
                <p className="mt-2">
                  <span className={`badge ${CONFIDENCE_BADGE[phase.result.confidence.level]} text-sm`}>
                    {phase.result.confidence.label}
                  </span>
                </p>
                <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-fg-muted">
                  {phase.result.confidence.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <details className="mt-3 text-xs text-fg-subtle">
                  <summary className="cursor-pointer text-accent-strong">How confidence is decided</summary>
                  <ul className="mt-2 space-y-1">
                    {CONFIDENCE_RULES.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                    <li>Computed on the server from these rules — the AI does not rate its own confidence.</li>
                  </ul>
                </details>
              </div>
            </div>

            {phase.result.evidence.length > 0 && (
              <div>
                <p className="eyebrow">Supporting evidence</p>
                <p className="mt-1 text-xs text-fg-subtle">
                  Each value is read from the live catalog on the server; the note beside it is the
                  assistant&apos;s reading of it.
                </p>
                <ul className="mt-3 grid gap-2">
                  {phase.result.evidence.map((e) => (
                    <li
                      key={`${e.slug}-${e.field}`}
                      className="grid gap-1 rounded-2xl border border-line bg-white/2 p-3 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${toneOf(e.slug).dot}`} />
                        <span className="truncate">{nameOf(e.slug)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="text-xs text-fg-subtle">{e.label}: </span>
                        <span className="text-fg">{e.value}</span>
                        {e.note && <span className="mt-1 block text-xs text-fg-muted">{e.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="eyebrow">Tradeoffs</p>
                {phase.result.tradeoffs.length === 0 ? (
                  <p className="mt-2 text-sm text-fg-muted">No tradeoffs were identified.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {phase.result.tradeoffs.map((t) => (
                      <li key={t} className="flex gap-2 text-sm text-fg-muted">
                        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-violet" />
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="eyebrow">Limitations</p>
                <p className="mt-2 text-sm text-fg-muted">{phase.result.limitation}</p>
                {phase.result.unaddressed.length > 0 && (
                  <>
                    <p className="mt-2 text-xs text-fg-subtle">Not covered by any listing field:</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {phase.result.unaddressed.map((u) => (
                        <li key={u} className="badge">
                          {u}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {phase.result.budget && (
                  <>
                    <p className="mt-3 text-xs text-fg-subtle">
                      Budget of {formatPrice(phase.result.budget.limitCents)}, checked in code:
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {phase.result.budget.products.map((b) => (
                        <li key={b.slug} className={`badge ${b.withinBudget ? "badge-positive" : "badge-negative"}`}>
                          {nameOf(b.slug)} · {formatPrice(b.priceCents)} {b.withinBudget ? "within" : "over"}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-fg-subtle">
              Written by {phase.result.model}
              {phase.result.cached ? " (reused from an identical earlier question)" : ""} ·{" "}
              {new Date(phase.result.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
