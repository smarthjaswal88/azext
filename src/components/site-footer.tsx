import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="container-app grid gap-8 py-10 text-sm text-fg-muted md:grid-cols-[1.4fr_1fr_1.4fr]">
        <div>
          <p className="text-base font-semibold text-fg">Nexus</p>
          <p className="mt-2 max-w-sm leading-relaxed">
            An independent product discovery and decision prototype. Discover, compare and decide
            with real listing data.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="eyebrow">Explore</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/" className="hover:text-fg">
                Discover
              </Link>
            </li>
            <li>
              <Link href="/compare" className="hover:text-fg">
                Compare
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-fg">
                Demo cart
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="eyebrow">About the data</p>
          <p className="mt-3 max-w-sm leading-relaxed">
            Product details come from public retailer listings collected once for this prototype;
            prices and stock may have changed since. Every product links to its source. Nexus does
            not sell or ship anything — the cart and checkout are a demo order flow.
          </p>
        </div>
      </div>
    </footer>
  );
}
