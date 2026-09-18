import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { getCategories, getFeaturedProducts } from "@/server/catalog";

export default async function HomePage() {
  const categories = await getCategories();
  const [headphones, clothing] = await Promise.all([
    getFeaturedProducts("headphones", 4),
    getFeaturedProducts("clothing", 4),
  ]);

  const rows = [
    { category: categories.find((c) => c.id === "headphones")!, products: headphones },
    { category: categories.find((c) => c.id === "clothing")!, products: clothing },
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-muted">
          <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10">
            <div className="flex flex-col justify-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Two categories, properly catalogued
              </h1>
              <p className="max-w-prose text-muted-ink">
                Headphones and clothing, each with real specifications, per-variant pricing and
                stock. Search, filter and sort across both.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/search?category=${c.id}`}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110"
                  >
                    Shop {c.name.toLowerCase()}
                  </Link>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/search?category=${c.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface p-4 transition hover:shadow-md"
                >
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-ink">{c.blurb}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {rows.map(({ category, products }) => (
          <section key={category.id} className="mt-10">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold">Top rated in {category.name.toLowerCase()}</h2>
              <Link
                href={`/search?category=${category.id}`}
                className="text-sm font-medium text-muted-ink hover:underline"
              >
                See all {category.name.toLowerCase()}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
