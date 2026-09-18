import Image from "next/image";
import Link from "next/link";
import { comparisonGroupOf } from "@/lib/comparison-group";
import { formatPrice } from "@/lib/format";
import { fromPriceCents, hasMultiplePrices, imagesForColor } from "@/lib/product";
import type { Product } from "@/lib/types";
import { CompareToggle } from "./compare-toggle";
import { RatingLine } from "./star-rating";

/** Fixed-height regions so a grid of cards lines up: square image area, title
 *  clamped to two lines, then rating and price pinned to the bottom. */
export function ProductCard({
  product,
  groupSize,
}: {
  product: Product;
  /** Products sharing this product's comparison group. */
  groupSize: number;
}) {
  const firstColor = product.optionAxes.find((a) => a.key === "color")?.values[0];
  const image = imagesForColor(product, firstColor?.id)[0];
  const price = fromPriceCents(product);
  const anyStock = product.variants.some((v) => v.available);
  const colors = product.optionAxes.find((a) => a.key === "color")?.values ?? [];

  return (
    <article className="group flex h-full flex-col rounded-lg border border-border-subtle bg-surface transition hover:border-border-strong hover:shadow-[0_2px_10px_rgba(15,17,17,0.10)]">
      <Link href={`/product/${product.slug}`} className="block p-2.5 pb-0">
        <div className="relative aspect-square overflow-hidden rounded bg-surface-image">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 240px"
            className="object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3 pt-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          {product.brand}
        </p>

        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug">
          <Link href={`/product/${product.slug}`} className="hover:text-ink-link hover:underline">
            {product.title}
          </Link>
        </h3>

        <RatingLine
          average={product.rating.average}
          ratingCount={product.rating.ratingCount}
          size={14}
        />

        <div className="mt-auto pt-1.5">
          <p className="flex items-baseline gap-1">
            {hasMultiplePrices(product) && (
              <span className="text-xs text-ink-muted">from</span>
            )}
            <span className="text-lg font-semibold tracking-tight">{formatPrice(price)}</span>
          </p>

          {colors.length > 1 && (
            <p className="mt-1.5 flex items-center gap-1" aria-label={`${colors.length} colours`}>
              {colors.map((c) => (
                <span
                  key={c.id}
                  title={c.label}
                  className="size-3.5 rounded-full border border-border-strong"
                  style={{ background: c.swatch }}
                />
              ))}
            </p>
          )}

          {!anyStock && (
            <p className="mt-1.5 text-xs font-medium text-sale">Currently unavailable</p>
          )}

          {/* Outside the product link on purpose: a button nested in an anchor
              is not a valid or predictable control. */}
          <CompareToggle
            slug={product.slug}
            group={comparisonGroupOf(product)}
            groupSize={groupSize}
          />
        </div>
      </div>
    </article>
  );
}
