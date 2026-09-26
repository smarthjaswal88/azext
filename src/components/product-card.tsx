import Link from "next/link";
import { catalogProductTypeLabel, type CatalogProductSummary } from "@/lib/catalog-api";
import { CompareToggle } from "./compare-toggle";
import { AvailabilityDot, PriceTag, RatingSummary } from "./product-meta";
import { RemoteImage } from "./remote-image";

/**
 * A live catalog product. The title link stretches over the card, so there is
 * one link per product; the compare control sits above it as its own button.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: CatalogProductSummary;
  /** Load the image eagerly — for the first cards above the fold. */
  priority?: boolean;
}) {
  return (
    <article className="glass group relative flex h-full flex-col p-3 transition duration-200 hover:border-line-strong hover:bg-white/6">
      <RemoteImage
        src={product.imageUrl}
        alt={product.title}
        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 300px"
        className="aspect-square"
        priority={priority}
      />

      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="badge">{catalogProductTypeLabel(product.productType)}</span>
          <AvailabilityDot availability={product.availability} />
        </div>

        {product.brand && <p className="eyebrow mt-3 truncate">{product.brand}</p>}
        <h3 className="mt-1.5 line-clamp-2 text-[0.95rem] font-medium leading-snug text-fg">
          <Link
            href={`/product/${product.slug}`}
            className="after:absolute after:inset-0 after:rounded-[1.25rem] after:content-[''] focus-visible:outline-none"
          >
            {product.title}
          </Link>
        </h3>

        <div className="mt-3">
          <RatingSummary rating={product.rating} ratingCount={product.ratingCount} size="sm" />
        </div>

        <div className="mt-auto pt-4">
          <PriceTag priceCents={product.priceCents} listPriceCents={product.listPriceCents} />
          <div className="relative z-10 mt-3">
            <CompareToggle
              block
              item={{
                slug: product.slug,
                category: product.category,
                title: product.title,
                imageUrl: product.imageUrl,
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="glass flex flex-col p-3" aria-hidden="true">
      <span className="skeleton block aspect-square rounded-2xl" />
      <span className="skeleton mt-4 block h-4 w-24" />
      <span className="skeleton mt-3 block h-3 w-16" />
      <span className="skeleton mt-2 block h-4 w-full" />
      <span className="skeleton mt-1.5 block h-4 w-3/4" />
      <span className="skeleton mt-6 block h-6 w-20" />
    </div>
  );
}
