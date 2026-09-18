import Image from "next/image";
import Link from "next/link";
import { formatCount, formatPrice } from "@/lib/format";
import { fromPriceCents, hasMultiplePrices, imagesForColor } from "@/lib/product";
import type { Product } from "@/lib/types";
import { RatingLine } from "./star-rating";

export function ProductCard({ product }: { product: Product }) {
  const firstColor = product.optionAxes.find((a) => a.key === "color")?.values[0];
  const image = imagesForColor(product, firstColor?.id)[0];
  const price = fromPriceCents(product);
  const anyStock = product.variants.some((v) => v.available);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface transition hover:shadow-md">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square bg-surface-muted">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
            className="object-contain p-4"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-ink">{product.brand}</p>
        <Link href={`/product/${product.slug}`} className="hover:underline">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{product.title}</h3>
        </Link>

        <RatingLine
          average={product.rating.average}
          ratingCount={product.rating.ratingCount}
          size={14}
        />

        <div className="mt-auto pt-1">
          <p className="text-lg font-semibold">
            {hasMultiplePrices(product) && (
              <span className="text-sm font-normal text-muted-ink">from </span>
            )}
            {formatPrice(price)}
          </p>
          <p className="text-xs text-muted-ink">
            {formatCount(product.rating.reviewCount)} written reviews
          </p>
          {!anyStock && (
            <p className="mt-1 text-xs font-medium text-sale">Currently unavailable</p>
          )}
        </div>
      </div>
    </article>
  );
}
