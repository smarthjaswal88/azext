import Link from "next/link";
import { getCategories } from "@/server/catalog";
import { CartCount } from "./cart-count";
import { SearchIcon } from "./icons";

export async function SiteHeader({
  defaultQuery = "",
}: {
  defaultQuery?: string;
}) {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-30">
      <div className="bg-header text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
          <Link
            href="/"
            className="shrink-0 rounded px-1 py-1 text-lg font-bold tracking-tight hover:opacity-85"
          >
            Shop
          </Link>

          <form
            action="/search"
            method="get"
            role="search"
            className="order-last flex h-10 w-full min-w-0 flex-1 md:order-none md:w-auto"
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
              className="min-w-0 flex-1 rounded-l-md border-0 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-muted"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex w-12 items-center justify-center rounded-r-md bg-accent text-accent-ink hover:bg-accent-hover"
            >
              <SearchIcon size={19} />
            </button>
          </form>

          <CartCount />
        </div>
      </div>

      <nav aria-label="Categories" className="bg-header-strip text-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-0.5 overflow-x-auto px-2 py-1 text-sm sm:px-3">
          <Link
            href="/search"
            className="whitespace-nowrap rounded px-3 py-1.5 font-medium hover:bg-white/10"
          >
            All products
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
    </header>
  );
}
