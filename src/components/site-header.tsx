import Link from "next/link";
import { getCategories } from "@/server/catalog";

/** Header is a server component: the search box is a plain GET form, so text
 *  search works with no client JavaScript and lands in the URL by itself.
 *
 *  There is deliberately no cart or account control here. Neither feature
 *  exists yet and a button that looks live but does nothing is worse than an
 *  absence. */
export async function SiteHeader({ defaultQuery = "" }: { defaultQuery?: string }) {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-20">
      <div className="bg-header text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link
            href="/"
            className="shrink-0 text-lg font-bold tracking-tight hover:opacity-80"
          >
            Shop
            <span className="ml-1 align-super text-[10px] font-normal opacity-70">demo</span>
          </Link>

          <form
            action="/search"
            method="get"
            role="search"
            className="order-last flex w-full min-w-0 flex-1 md:order-none md:w-auto"
          >
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <input
              id="site-search"
              type="search"
              name="q"
              defaultValue={defaultQuery}
              placeholder="Search headphones and clothing"
              className="min-w-0 flex-1 rounded-l-md border border-transparent bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              className="rounded-r-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110"
            >
              Search
            </button>
          </form>

          <Link
            href="/search"
            className="shrink-0 text-sm hover:underline"
          >
            All products
          </Link>
        </div>
      </div>

      <nav
        aria-label="Categories"
        className="bg-header-strip text-white/90"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-2 py-1.5 text-sm">
          <Link
            href="/search"
            className="whitespace-nowrap rounded px-3 py-1.5 hover:bg-white/10"
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/search?category=${c.id}`}
              className="whitespace-nowrap rounded px-3 py-1.5 hover:bg-white/10"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </nav>

      <p className="bg-surface-muted px-4 py-1.5 text-center text-xs text-muted-ink">
        Demo storefront — every product, price, image and review here is invented for this
        prototype.
      </p>
    </header>
  );
}
