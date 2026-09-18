import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Shop — demo storefront",
    template: "%s · Shop",
  },
  description:
    "Demo shopping storefront for headphones and clothing, with an optional AI product comparison planned.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-page">
        {children}
        <footer className="mt-6 border-t border-border-subtle bg-surface">
          <div className="mx-auto max-w-[1500px] px-4 py-6 text-sm text-ink-muted">
            <p className="font-semibold text-ink">Shop — prototype</p>
            <p className="mt-1.5 max-w-2xl">
              Browsing, search, product pages, cart and a simulated checkout are built. Product
              comparison and AI-written explanations are not, so there are no controls for them.
            </p>
            <p className="mt-2">
              Every product, price, image and review here is invented for this prototype.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
