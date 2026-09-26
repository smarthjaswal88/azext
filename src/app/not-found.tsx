import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20 pt-16">
        <div className="glass mx-auto max-w-xl p-8 text-center">
          <p className="eyebrow">404</p>
          <h1 className="mt-3 text-2xl font-semibold text-fg">This page doesn&apos;t exist</h1>
          <p className="mt-2 text-fg-muted">The address may be mistyped, or the page has moved.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-primary">
              Discover products
            </Link>
            <Link href="/compare" className="btn btn-secondary">
              Open comparison
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
