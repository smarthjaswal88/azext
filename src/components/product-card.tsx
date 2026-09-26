import Link from "next/link";
import { catalogProductTypeLabel, type CatalogProductSummary } from "@/lib/catalog-api";
import { optionsPricedText, outOfStockText } from "@/lib/listing-highlights";
import { CompareToggle } from "./compare-toggle";
import { ArrowRightIcon } from "./icons";
import { PriceTag, RatingSummary } from "./product-meta";
import { RemoteImage } from "./remote-image";

/** Only a problem is flagged; an in-stock listing stays quiet. */
function StockFlag({ availability }: { availability: CatalogProductSummary["availability"] }) {
  if (availability === "out_of_stock") {
    return <span className="badge badge-negative absolute left-2 top-2 bg-graphite-900/90">Out of stock</span>;
  }
  if (availability === "limited_stock") {
    return <span className="badge badge-caution absolute left-2 top-2 bg-graphite-900/90">Limited stock</span>;
  }
  return null;
}

/**
 * "7 of 31 options priced". Options without a price cannot be selected on the
 * product page; they are not out of stock, and the note never says so. It is
 * quiet unless nothing can be bought. A single, priced option needs no note,
 * but keeps the line's height so prices stay level across a row.
 */
function OptionsNote({ counts }: { counts: CatalogProductSummary["optionCounts"] }) {
  if (counts.total <= 1 && counts.purchasable === counts.total) {
    return <p aria-hidden="true" className="mt-1.5 hidden h-4 sm:block" />;
  }
  const outOfStock = outOfStockText(counts);
  if (counts.purchasable === 0) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs leading-4 text-caution">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-caution" />
        {optionsPricedText(counts)}
        {outOfStock && ` · ${outOfStock}`} · none can be selected
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-xs leading-4 text-fg-subtle">
      {optionsPricedText(counts)}
      {outOfStock && ` · ${outOfStock}`}
    </p>
  );
}

/**
 * A live catalog product. The title link stretches over the card, so there is
 * one link per product; the compare control sits above it as its own button,
 * and "Details" is only a visual cue for that same link.
 *
 * Below 640px the card is a row — photo left, facts right — so more products
 * fit on a phone screen; from 640px it is a column with a large photo.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: CatalogProductSummary;
  /** Load the image eagerly — for the first cards above the fold. */
  priority?: boolean;
}) {
  const typeLabel = catalogProductTypeLabel(product.productType);
  const unavailable = product.availability === "out_of_stock";

  return (
    <article className="glass group relative grid h-full grid-cols-[6.5rem_minmax(0,1fr)] content-start gap-x-3.5 gap-y-2.5 p-2.5 transition duration-200 hover:border-line-strong hover:bg-tint/6 has-aria-pressed:border-accent/55 sm:flex sm:flex-col sm:gap-0 sm:p-3 sm:hover:-translate-y-0.5">
      <div className="relative self-start sm:self-stretch">
        <RemoteImage
          src={product.imageUrl}
          alt={product.title}
          sizes="(max-width: 640px) 104px, 320px"
          className={`aspect-square sm:aspect-4/3 ${unavailable ? "opacity-60" : ""}`}
          padding="p-2.5 sm:p-5"
          priority={priority}
        />
        <StockFlag availability={product.availability} />
      </div>

      <div className="row-span-2 flex min-w-0 flex-col sm:flex-1 sm:px-1 sm:pt-3.5">
        {/* Brand, then type. The brand keeps its full name: when both do not
            fit on a narrow card, the type wraps to a second line. Each item
            draws its "·" in its own left padding, and the row is shifted
            left by that padding inside a clipping box, so the dot before
            whichever item starts a line is clipped away. */}
        <p className="overflow-hidden text-[0.7rem] leading-4">
          <span className="-ml-3 flex flex-wrap">
            {product.brand && (
              <span className="relative max-w-full truncate pl-3 font-semibold uppercase tracking-[0.12em] text-fg-muted before:absolute before:left-1 before:tracking-normal before:text-fg-subtle before:content-['·']">
                {product.brand}
              </span>
            )}
            <span className="relative min-w-0 truncate pl-3 text-fg-subtle before:absolute before:left-1 before:content-['·']">
              {typeLabel}
            </span>
          </span>
        </p>

        <h3 className="mt-1.5 line-clamp-2 text-[0.92rem] font-medium leading-snug text-fg">
          <Link
            href={`/product/${product.slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-[1.25rem] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--focus-ring)"
          >
            {product.title}
          </Link>
        </h3>

        <div className="mt-1.5">
          <RatingSummary rating={product.rating} ratingCount={product.ratingCount} size="sm" countLabel />
        </div>

        {product.highlights.length > 0 && (
          <ul aria-label="Key features" className="mt-2.5 flex min-w-0 flex-wrap gap-1.5">
            {product.highlights.map((highlight, index) => (
              <li key={highlight.text} className={`tag ${index >= 2 ? "max-sm:hidden" : ""}`}>
                {/* Visually clipped with an ellipsis if it ever outgrows the
                    card; the full text is always what is announced. */}
                <span aria-hidden="true" className="min-w-0 truncate">
                  {highlight.text}
                </span>
                <span className="sr-only">{highlight.text}</span>
              </li>
            ))}
          </ul>
        )}

        {product.material && (
          <p className="mt-2 text-[0.72rem] leading-snug text-fg-muted">
            <span className="text-fg-subtle">Material · </span>
            {product.material}
          </p>
        )}

        <div className="mt-2.5 sm:mt-auto sm:pt-4">
          <PriceTag priceCents={product.priceCents} listPriceCents={product.listPriceCents} />
          <OptionsNote counts={product.optionCounts} />
        </div>
      </div>

      {/* Click-through except for the compare control, so "Details" and the
          gaps fall through to the stretched title link underneath. On a
          phone it sits under the photo, where the whole card is the link. */}
      <div className="pointer-events-none z-10 col-start-1 row-start-2 flex items-center gap-2 max-sm:static sm:relative sm:mt-3.5 sm:px-1 sm:pb-1">
        <CompareToggle
          floating
          className="pointer-events-auto min-w-0 flex-1"
          buttonClassName="max-sm:min-h-11"
          item={{
            slug: product.slug,
            category: product.category,
            title: product.title,
            imageUrl: product.imageUrl,
          }}
        />
        <span
          aria-hidden="true"
          className="btn btn-ghost btn-sm shrink-0 text-fg-muted group-hover:bg-tint/6 group-hover:text-fg max-sm:hidden"
        >
          Details
          <ArrowRightIcon size={14} />
        </span>
      </div>
    </article>
  );
}

/**
 * The same frame as a card, line for line, so the grid does not move when
 * products arrive: photo, brand line, two title lines, rating, a tag row,
 * price, options line and the action row, each at its real height.
 */
export function ProductCardSkeleton() {
  return (
    <div
      className="glass grid grid-cols-[6.5rem_minmax(0,1fr)] content-start gap-x-3.5 gap-y-2.5 p-2.5 sm:flex sm:flex-col sm:gap-0 sm:p-3"
      aria-hidden="true"
    >
      <span className="skeleton block aspect-square rounded-2xl sm:aspect-4/3" />
      <span className="row-span-2 flex flex-col sm:flex-1 sm:px-1 sm:pt-3.5">
        <span className="skeleton block h-4 w-32" />
        <span className="mt-1.5 block h-[2.53rem] py-0.5">
          <span className="skeleton block h-4 w-full" />
          <span className="skeleton mt-1.5 block h-4 w-3/4" />
        </span>
        <span className="skeleton mt-1.5 block h-4 w-36" />
        <span className="mt-2.5 flex gap-1.5">
          <span className="skeleton block h-[1.4rem] w-24 rounded-lg" />
          <span className="skeleton block h-[1.4rem] w-20 rounded-lg" />
        </span>
        <span className="mt-2.5 block sm:mt-auto sm:pt-4">
          <span className="skeleton block h-7 w-24" />
          <span className="skeleton mt-1.5 block h-4 w-36" />
        </span>
      </span>
      <span className="col-start-1 row-start-2 flex gap-2 sm:mt-3.5 sm:px-1 sm:pb-1">
        <span className="skeleton block h-11 flex-1 rounded-xl sm:h-9" />
        <span className="skeleton hidden h-9 w-20 rounded-xl sm:block" />
      </span>
    </div>
  );
}
