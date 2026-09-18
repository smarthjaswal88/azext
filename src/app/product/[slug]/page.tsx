import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { RatingLine, StarRating } from "@/components/star-rating";
import { formatCount, formatPrice } from "@/lib/format";
import {
  discountPercent,
  findVariant,
  findVariantById,
  imagesForColor,
  valueHasStock,
  type Selection,
} from "@/lib/product";
import type { OptionKey, Product, Variant } from "@/lib/types";
import { getCategory, getProductBySlug } from "@/server/catalog";

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Renders a variant as "Midnight · Large" using the product's own labels. */
function describeVariant(product: Product, variant: Variant): string {
  return product.optionAxes
    .map((axis) => axis.values.find((v) => v.id === variant.options[axis.key])?.label)
    .filter(Boolean)
    .join(" · ");
}

/** Keeps the current selection and changes one axis. Changing colour drops the
 *  gallery index, because the images themselves change. */
function selectionHref(
  slug: string,
  selection: Selection,
  key: OptionKey,
  valueId: string,
): string {
  const sp = new URLSearchParams();
  const next: Selection = { ...selection, [key]: valueId };
  if (next.color) sp.set("color", next.color);
  if (next.size) sp.set("size", next.size);
  return `/product/${slug}?${sp.toString()}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return { title: product ? product.title : "Product not found" };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const sp = await searchParams;
  const category = await getCategory(product.category);

  const colorAxis = product.optionAxes.find((a) => a.key === "color");
  const sizeAxis = product.optionAxes.find((a) => a.key === "size");

  // Fall back to the first purchasable variant whenever the URL names an option
  // that does not exist, so a hand-edited or stale link still renders.
  const firstAvailable = product.variants.find((v) => v.available) ?? product.variants[0];
  const rawColor = one(sp, "color");
  const rawSize = one(sp, "size");
  const color = colorAxis?.values.some((v) => v.id === rawColor)
    ? rawColor
    : firstAvailable.options.color;
  const size = sizeAxis?.values.some((v) => v.id === rawSize)
    ? rawSize
    : firstAvailable.options.size;

  let selection: Selection = { color, size };
  let variant = findVariant(product, selection);
  if (!variant) {
    variant = product.variants.find((v) => v.options.color === color) ?? firstAvailable;
    selection = { ...variant.options };
  }

  const gallery = imagesForColor(product, selection.color);
  const imgIndex = Math.min(Math.max(Number(one(sp, "img") ?? 0) || 0, 0), gallery.length - 1);
  const hero = gallery[imgIndex];

  const discount = discountPercent(variant);
  const histogramMax = Math.max(...Object.values(product.rating.histogram));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-ink">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-1.5">›</span>
          <Link href={`/search?category=${product.category}`} className="hover:underline">
            {category?.name}
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">{product.brand}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]">
          {/* Gallery */}
          <section className="lg:sticky lg:top-36 lg:self-start">
            <div className="flex gap-3">
              <ol className="flex w-14 shrink-0 flex-col gap-2">
                {gallery.map((img, i) => (
                  <li key={img.src}>
                    <Link
                      href={`/product/${product.slug}?${new URLSearchParams({
                        ...(selection.color ? { color: selection.color } : {}),
                        ...(selection.size ? { size: selection.size } : {}),
                        img: String(i),
                      })}`}
                      scroll={false}
                      aria-label={img.alt}
                      aria-current={i === imgIndex}
                      className={`relative block aspect-square overflow-hidden rounded border bg-surface-muted ${
                        i === imgIndex ? "border-accent ring-1 ring-accent" : "border-border-subtle"
                      }`}
                    >
                      <Image src={img.src} alt="" fill sizes="56px" className="object-contain p-1" />
                    </Link>
                  </li>
                ))}
              </ol>
              <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-muted">
                <Image
                  src={hero.src}
                  alt={hero.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 420px"
                  className="object-contain p-6"
                />
              </div>
            </div>
          </section>

          {/* Details and variant selection */}
          <section className="min-w-0">
            <p className="text-sm text-muted-ink">{product.brand}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight">{product.title}</h1>

            <div className="mt-2">
              <RatingLine
                average={product.rating.average}
                ratingCount={product.rating.ratingCount}
                href="#reviews"
              />
            </div>

            <p className="mt-4 text-muted-ink">{product.summary}</p>

            <hr className="my-5 border-border-subtle" />

            {product.optionAxes.map((axis) => {
              const selected = axis.values.find((v) => v.id === selection[axis.key]);
              return (
                <div key={axis.key} className="mb-5">
                  <p className="mb-2 text-sm">
                    <span className="text-muted-ink">{axis.label}: </span>
                    <span className="font-semibold">{selected?.label}</span>
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {axis.values.map((value) => {
                      const isSelected = value.id === selection[axis.key];
                      const inStock = valueHasStock(product, axis.key, value.id, selection);
                      return (
                        <li key={value.id}>
                          <Link
                            href={selectionHref(product.slug, selection, axis.key, value.id)}
                            scroll={false}
                            aria-current={isSelected}
                            title={inStock ? value.label : `${value.label} — unavailable`}
                            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
                              isSelected
                                ? "border-accent ring-1 ring-accent"
                                : "border-border-subtle hover:border-foreground"
                            } ${inStock ? "" : "text-muted-ink line-through decoration-1 opacity-70"}`}
                          >
                            {value.swatch && (
                              <span
                                aria-hidden="true"
                                className="inline-block size-4 rounded-full border border-border-subtle"
                                style={{ background: value.swatch }}
                              />
                            )}
                            {value.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <h2 className="mb-2 mt-8 text-base font-semibold">Specifications</h2>
            <dl className="overflow-hidden rounded-lg border border-border-subtle text-sm">
              {product.specs.map((spec, i) => (
                <div
                  key={spec.label}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2 ${
                    i % 2 === 0 ? "bg-surface-muted" : "bg-surface"
                  }`}
                >
                  <dt className="font-medium text-muted-ink">{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Buy box. Price and availability come from the selected variant. */}
          <aside className="lg:sticky lg:top-36 lg:self-start">
            <div className="rounded-lg border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                {discount !== undefined && (
                  <span className="text-lg font-semibold text-sale">-{discount}%</span>
                )}
                <span className="text-2xl font-bold">{formatPrice(variant.priceCents)}</span>
              </div>
              {variant.listPriceCents !== undefined && discount !== undefined && (
                <p className="mt-0.5 text-sm text-muted-ink">
                  Was <s>{formatPrice(variant.listPriceCents)}</s>
                </p>
              )}

              <p className="mt-3 text-sm">
                {variant.available ? (
                  <span className="font-medium text-green-700 dark:text-green-400">In stock</span>
                ) : (
                  <span className="font-medium text-sale">
                    Unavailable in {describeVariant(product, variant)}
                  </span>
                )}
              </p>

              {!variant.available && (
                <p className="mt-1 text-sm text-muted-ink">
                  Pick another option above — the ones you cannot choose are struck through.
                </p>
              )}

              <dl className="mt-4 space-y-1 border-t border-border-subtle pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-ink">Selection</dt>
                  <dd className="text-right font-medium">{describeVariant(product, variant)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-ink">Variant ID</dt>
                  <dd className="text-right font-mono text-xs">{variant.id}</dd>
                </div>
              </dl>

              <p className="mt-4 rounded-md bg-surface-muted p-3 text-xs text-muted-ink">
                Cart and checkout are not built yet, so there is no purchase button here. They
                arrive in a later step.
              </p>
            </div>
          </aside>
        </div>

        {/* Reviews */}
        <section id="reviews" className="mt-12 scroll-mt-36 border-t border-border-subtle pt-8">
          <h2 className="text-xl font-semibold">Ratings and reviews</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-ink">
            These reviews are written demo content for this prototype. They are not customer
            feedback and describe a product that does not exist.
          </p>

          <div className="mt-6 grid gap-8 lg:grid-cols-[300px_1fr]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">{product.rating.average.toFixed(1)}</span>
                <div>
                  <StarRating value={product.rating.average} size={18} />
                  <p className="text-sm text-muted-ink">out of 5</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-ink">
                {formatCount(product.rating.ratingCount)} ratings ·{" "}
                {formatCount(product.rating.reviewCount)} written reviews
              </p>

              <ul className="mt-4 space-y-1.5">
                {([5, 4, 3, 2, 1] as const).map((star) => {
                  const count = product.rating.histogram[star];
                  const pct = Math.round((count / product.rating.ratingCount) * 100);
                  return (
                    <li key={star} className="flex items-center gap-2 text-sm">
                      <span className="w-12 shrink-0 text-muted-ink">{star} star</span>
                      <span className="h-3.5 flex-1 overflow-hidden rounded-sm border border-border-subtle bg-surface-muted">
                        <span
                          className="block h-full bg-star"
                          style={{ width: `${(count / histogramMax) * 100}%` }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-right text-muted-ink">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <ol className="space-y-6">
              {product.reviews.map((r) => {
                const bought = r.variantId ? findVariantById(product, r.variantId) : undefined;
                return (
                  <li key={r.id} className="border-b border-border-subtle pb-5 last:border-0">
                    <p className="text-sm font-medium text-muted-ink">{r.authorLabel}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StarRating value={r.rating} size={15} />
                      <h3 className="text-sm font-semibold">{r.title}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-ink">
                      Reviewed on{" "}
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {bought && <> · {describeVariant(product, bought)}</>}
                      {r.verifiedPurchase && (
                        <> · <span className="font-medium text-accent">Verified purchase</span></>
                      )}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{r.body}</p>
                    {r.helpfulCount > 0 && (
                      <p className="mt-2 text-xs text-muted-ink">
                        {formatCount(r.helpfulCount)} people found this helpful
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </main>
    </>
  );
}
