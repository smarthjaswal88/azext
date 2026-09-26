/**
 * The comparison itself. Every figure is computed in src/lib/compare-insights
 * from the listing data shown; each section says what it is computed from.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import type { CatalogProductDetail } from "@/lib/catalog-api";
import {
  buildInsights,
  buildKeyDifferences,
  buildSignals,
  buildSpecRows,
  buildTradeoffs,
  shortName,
  type ComparisonRow,
} from "@/lib/compare-insights";
import { SparkIcon } from "../icons";

/** One consistent colour per compared product, used everywhere on the page. */
export const PRODUCT_TONES = [
  { dot: "bg-accent", bar: "from-accent to-accent-strong", ring: "border-accent/60", top: "border-t-accent/80" },
  { dot: "bg-violet", bar: "from-violet to-fuchsia-300", ring: "border-violet/60", top: "border-t-violet/80" },
  { dot: "bg-teal-300", bar: "from-teal-400 to-teal-200", ring: "border-teal-300/60", top: "border-t-teal-300/80" },
] as const;

function ProductKey({ index, product }: { index: number; product: CatalogProductDetail }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${PRODUCT_TONES[index].dot}`} />
      <span className="truncate">{shortName(product)}</span>
    </span>
  );
}

function Panel({ id, eyebrow, title, method, children }: {
  id: string;
  eyebrow: string;
  title: string;
  method?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="glass p-5 sm:p-6">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-1.5 text-lg font-semibold text-fg">
        {title}
      </h2>
      {method && <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{method}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function InsightSummary({ products }: { products: CatalogProductDetail[] }) {
  const insights = buildInsights(products);
  const index = (slug: string) => products.findIndex((p) => p.slug === slug);
  return (
    <Panel
      id="insights-heading"
      eyebrow="Insight summary"
      title="What stands out"
      method="Computed from the listings' prices, ratings, rating counts, previous prices and priced options. A tie is shown as a tie; a signal every product shares is left out."
    >
      {insights.length === 0 ? (
        <p className="text-sm text-fg-muted">These products are level on every measured signal.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {insights.map((insight) => {
            const first = index(insight.slugs[0]);
            return (
              <li
                key={insight.key}
                className={`rounded-2xl border bg-tint/2 p-4 ${insight.slugs.length === 1 ? PRODUCT_TONES[first].ring : "border-line-strong"}`}
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
                  <SparkIcon size={14} />
                  {insight.label}
                  {insight.slugs.length > 1 && <span className="text-fg-subtle">· tie</span>}
                </p>
                <ul className="mt-2 space-y-1 text-sm font-medium text-fg">
                  {insight.slugs.map((slug) => (
                    <li key={slug}>
                      <ProductKey index={index(slug)} product={products[index(slug)]} />
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-sm text-fg-muted">{insight.detail}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function SignalBars({ products }: { products: CatalogProductDetail[] }) {
  const signals = buildSignals(products);
  return (
    <Panel
      id="signals-heading"
      eyebrow="Score indicators"
      title="Relative signals"
      method="Each bar is relative to the products compared here — a full bar means best in this set, not best overall."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {signals.map((signal) => (
          <div key={signal.key}>
            <p className="text-sm font-medium text-fg">{signal.label}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">{signal.method}</p>
            <ul className="mt-3 space-y-2.5">
              {signal.values.map((value, i) => (
                <li key={value.slug} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
                  <span className="min-w-0 overflow-hidden text-fg-muted">
                    <ProductKey index={i} product={products[i]} />
                  </span>
                  <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-tint/7">
                    <span
                      className={`block h-full rounded-full bg-linear-to-r ${PRODUCT_TONES[i].bar}`}
                      style={{ width: `${Math.round((value.ratio ?? 0) * 100)}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-fg">{value.display}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RowTable({ rows, products, caption, emptyText }: {
  rows: ComparisonRow[];
  products: CatalogProductDetail[];
  caption: string;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-fg-muted">{emptyText}</p>;
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-44 border-b border-line pb-3 text-left text-xs font-medium text-fg-subtle">
              Attribute
            </th>
            {products.map((p, i) => (
              <th key={p.slug} scope="col" className="border-b border-line pb-3 pl-4 text-left text-xs font-medium text-fg-muted">
                <ProductKey index={i} product={p} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="border-b border-line py-3 pr-4 text-left align-top font-normal text-fg-subtle">
                {row.label}
                {row.differs && <span className="sr-only"> (differs)</span>}
              </th>
              {row.values.map((value, i) => (
                <td key={products[i].slug} className="border-b border-line py-3 pl-4 align-top text-fg">
                  {value ?? <span className="text-fg-subtle">Not listed</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyDifferences({ products }: { products: CatalogProductDetail[] }) {
  return (
    <Panel
      id="differences-heading"
      eyebrow="Key differences"
      title="Where they differ"
      method="Headline attributes that differ, then specifications that at least two listings state and that disagree."
    >
      <RowTable
        rows={buildKeyDifferences(products)}
        products={products}
        caption="Attributes that differ between the compared products"
        emptyText="No differences found in the listed attributes."
      />
    </Panel>
  );
}

export function Tradeoffs({ products }: { products: CatalogProductDetail[] }) {
  const tradeoffs = buildTradeoffs(products);
  return (
    <Panel
      id="tradeoffs-heading"
      eyebrow="Tradeoffs"
      title="What you give up for what"
      method="Plain comparisons of price, rating, rating volume and availability. Not a recommendation."
    >
      {tradeoffs.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nothing stood out: price, rating, rating volume and availability don&apos;t pull these
          products in different directions.
        </p>
      ) : (
        <ul className="space-y-3">
          {tradeoffs.map((t) => (
            <li key={t} className="flex gap-3 text-sm leading-relaxed text-fg-muted">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-violet" />
              {t}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function SpecificationMatrix({ products }: { products: CatalogProductDetail[] }) {
  const rows = buildSpecRows(products);
  return (
    <Panel
      id="specs-heading"
      eyebrow="Specifications"
      title="Every listed specification"
      method="The union of all specification labels, most widely shared first. A missing value is shown as not listed — never borrowed from another product."
    >
      <details className="group">
        <summary className="btn btn-secondary btn-sm cursor-pointer list-none">
          <span className="group-open:hidden">Show all {rows.length} rows</span>
          <span className="hidden group-open:inline">Hide specifications</span>
        </summary>
        <div className="mt-5">
          <RowTable
            rows={rows}
            products={products}
            caption="All listed specifications"
            emptyText="None of these listings include specifications."
          />
        </div>
      </details>
    </Panel>
  );
}

export function FeatureColumns({ products }: { products: CatalogProductDetail[] }) {
  return (
    <Panel id="features-heading" eyebrow="Features" title="In each listing's own words" method="The first four feature bullets from each listing.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((p, i) => (
          <div key={p.slug}>
            <p className="text-sm font-medium text-fg">
              <ProductKey index={i} product={p} />
            </p>
            {p.features.length === 0 ? (
              <p className="mt-2 text-sm text-fg-subtle">No feature bullets in the listing.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="line-clamp-3 text-sm leading-relaxed text-fg-muted">
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/product/${p.slug}`} className="link mt-3 inline-block text-xs">
              Full details
            </Link>
          </div>
        ))}
      </div>
    </Panel>
  );
}
