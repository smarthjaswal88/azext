import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16">
        <h1 className="text-2xl font-semibold">We could not find that page</h1>
        <p className="mt-2 max-w-prose text-muted-ink">
          The product may have been renamed, or the address may be mistyped.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/search"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110"
          >
            Browse all products
          </Link>
          <Link
            href="/"
            className="rounded-md border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Go to the homepage
          </Link>
        </div>
      </main>
    </>
  );
}
