"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { catalogCategoryLabel, catalogProductTypeLabel, type CatalogProductDetail } from "@/lib/catalog-api";
import { AVAILABILITY_LABELS, purchasableVariants } from "@/lib/compare-insights";
import { countOptions } from "@/lib/listing-highlights";
import { useCatalogProduct } from "@/lib/use-catalog";
import { CompareToggle } from "../compare-toggle";
import { ExternalIcon } from "../icons";
import { PriceTag, RatingSummary } from "../product-meta";
import { RemoteImage } from "../remote-image";
import { DemoNotice, Skeleton, StatePanel } from "../ui";
import { AddToDemoCart } from "./add-to-demo-cart";
import { VariantPicker } from "./variant-picker";

const AVAILABILITY_BADGE: Record<CatalogProductDetail["availability"], string> = {
  in_stock: "badge-positive",
  limited_stock: "badge-caution",
  out_of_stock: "badge-negative",
  unknown: "",
};

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the source";
  }
}

/** Listing descriptions often repeat the feature bullets word for word;
 *  showing the same text twice adds nothing, so such a description is left
 *  out. The text itself is never edited. */
function repeatsFeatures(description: string, features: string[]): boolean {
  if (features.length === 0) return false;
  const text = description.toLowerCase();
  return features.slice(0, 3).every((f) => text.includes(f.toLowerCase().slice(0, 48)));
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function ProductDetail({ slug }: { slug: string }) {
  const { state, retry } = useCatalogProduct(slug);

  if (state.status === "loading") return <DetailSkeleton />;

  if (state.status === "error") {
    return state.error.status === 404 ? (
      <div className="pt-14">
        <StatePanel
          title="This product isn't in the catalog"
          action={
            <Link href="/" className="btn btn-secondary">
              Back to discovery
            </Link>
          }
        >
          The link may be out of date, or the product was not part of the import.
        </StatePanel>
      </div>
    ) : (
      <div className="pt-14">
        <StatePanel
          tone="error"
          title="This product could not be loaded"
          action={
            <button type="button" onClick={retry} className="btn btn-secondary">
              Try again
            </button>
          }
        >
          {state.error.message}
        </StatePanel>
      </div>
    );
  }

  // Keyed so moving to another product starts with that product's options.
  return <ProductView key={state.data.id} product={state.data} />;
}

/** The product page itself, for a product already loaded — on the server by
 *  the page, or in the browser by ProductDetail. */
export function ProductView({ product }: { product: CatalogProductDetail }) {
  useEffect(() => {
    document.title = `${product.title} · Vetra`;
  }, [product.title]);

  const options = useMemo(
    () => purchasableVariants(product).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [product],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(options[0]?.id);
  const selected = options.find((v) => v.id === selectedId);

  // The listing's price and was-price belong to its default option; any other
  // option shows its own price and no was-price.
  const priceCents = selected?.priceCents ?? product.priceCents;
  const listPriceCents = selected && !selected.isDefault ? null : product.listPriceCents;

  return (
    <article className="pt-8">
      <nav aria-label="Breadcrumb" className="text-sm text-fg-subtle">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-fg">
              Discover
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/?category=${product.category}`} className="hover:text-fg">
              {catalogCategoryLabel(product.category)}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/?category=${product.category}&type=${product.productType}`} className="hover:text-fg">
              {catalogProductTypeLabel(product.productType)}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass p-3">
            <RemoteImage
              src={product.imageUrl}
              alt={product.title}
              priority
              sizes="(max-width: 1024px) 92vw, 560px"
              className="aspect-square"
              padding="p-8"
            />
          </div>
        </div>

        <div className="min-w-0">
          {product.brand && <p className="eyebrow">{product.brand}</p>}
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-3xl">
            {product.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <RatingSummary rating={product.rating} ratingCount={product.ratingCount} />
            {product.ratingCount !== null && <span className="text-sm text-fg-subtle">ratings on the source listing</span>}
          </div>

          <div className="glass mt-6 p-5">
            <PriceTag priceCents={priceCents} listPriceCents={listPriceCents} size="lg" />
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <span className={`badge ${AVAILABILITY_BADGE[product.availability]}`}>
                {AVAILABILITY_LABELS[product.availability]}
              </span>
              {product.availabilityText && product.availabilityText !== AVAILABILITY_LABELS[product.availability] && (
                <span>“{product.availabilityText}”</span>
              )}
              <span className="text-fg-subtle">· listing data as of {formatDay(product.fetchedAt)}</span>
            </p>

            <div className="mt-6">
              <VariantPicker
                options={options}
                selectedId={selectedId}
                onSelect={setSelectedId}
                counts={countOptions(product.variants)}
              />
            </div>

            <div className="mt-6">
              <AddToDemoCart variantId={selected?.id} disabled={!selected} />
            </div>

            <div className="mt-4 grid items-start gap-3 sm:grid-cols-2">
              <CompareToggle
                block
                item={{
                  slug: product.slug,
                  category: product.category,
                  title: product.title,
                  imageUrl: product.imageUrl,
                }}
              />
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn btn-secondary btn-sm btn-block"
              >
                <ExternalIcon size={15} />
                View source
                <span className="sr-only">(opens {sourceHost(product.sourceUrl)} in a new tab)</span>
              </a>
            </div>
            <p className="mt-2 text-xs text-fg-subtle">
              “View source” opens the original listing on {sourceHost(product.sourceUrl)}.
            </p>

            <DemoNotice className="mt-5 border-t border-line pt-4" />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="features-heading" className="glass p-6">
          <h2 id="features-heading" className="text-lg font-semibold text-fg">
            Features
          </h2>
          {product.features.length === 0 ? (
            <p className="mt-3 text-sm text-fg-muted">The listing does not include feature bullets.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {product.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm leading-relaxed text-fg-muted">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="specs-heading" className="glass p-6">
          <h2 id="specs-heading" className="text-lg font-semibold text-fg">
            Specifications
          </h2>
          {product.specifications.length === 0 ? (
            <p className="mt-3 text-sm text-fg-muted">The listing does not include specifications.</p>
          ) : (
            <dl className="mt-4 divide-y divide-line">
              {product.specifications.map((spec) => (
                <div key={spec.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-2.5 text-sm">
                  <dt className="text-fg-subtle">{spec.label}</dt>
                  <dd className="text-fg">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      {((product.description && !repeatsFeatures(product.description, product.features)) ||
        product.sourceCategories.length > 0) && (
        <section aria-labelledby="about-heading" className="glass mt-6 p-6">
          <h2 id="about-heading" className="text-lg font-semibold text-fg">
            From the listing
          </h2>
          {product.description && !repeatsFeatures(product.description, product.features) && (
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-fg-muted">{product.description}</p>
          )}
          {product.sourceCategories.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
              Filed under
              {product.sourceCategories.map((c) => (
                <span key={c} className="badge">
                  {c}
                </span>
              ))}
            </p>
          )}
        </section>
      )}
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="pt-8" aria-busy="true">
      <p role="status" className="sr-only">
        Loading product
      </p>
      <Skeleton className="h-4 w-48" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Skeleton className="aspect-square rounded-[1.25rem]" />
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-full" />
          <Skeleton className="mt-2 h-8 w-2/3" />
          <Skeleton className="mt-6 h-64 rounded-[1.25rem]" />
        </div>
      </div>
    </div>
  );
}
