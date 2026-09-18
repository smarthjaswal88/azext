import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import {
  getCategories, getFeaturedProducts ,
  getComparisonGroupCounts,
} from "@/server/catalog";

export default async function HomePage() {
  const categories = await getCategories();
  const groupCounts = await getComparisonGroupCounts();
  const [headphones, clothing] = await Promise.all([
    getFeaturedProducts("headphones", 6),
    getFeaturedProducts("clothing", 6),
  ]);

  const rows = [
    { category: categories.find((c) => c.id === "headphones")!, products: headphones },
    { category: categories.find((c) => c.id === "clothing")!, products: clothing },
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-3 sm:px-4 sm:py-4">
        {/* Compact banner: one line of copy and two ways in. Deliberately short
            so the product rows start near the top of the page. */}
        <section className="rounded-lg border border-border-subtle bg-surface px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Find your everyday favorites.
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                Headphones and clothing, in one place.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:w-[420px]">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/search?category=${c.id}`}
                  className="rounded-md border border-border-subtle bg-surface-muted px-3 py-2.5 text-sm font-semibold transition hover:border-border-strong hover:bg-surface"
                >
                  {c.name}
                  <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                    Shop all
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {rows.map(({ category, products }) => (
          <section key={category.id} className="mt-3 rounded-lg border border-border-subtle bg-surface p-3 sm:p-4">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-base font-bold sm:text-lg">
                Top rated in {category.name.toLowerCase()}
              </h2>
              <Link
                href={`/search?category=${category.id}`}
                className="shrink-0 text-sm text-ink-link hover:underline"
              >
                See all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  groupSize={groupCounts[p.comparisonGroup]}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
