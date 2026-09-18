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
      <body className="flex min-h-full flex-col bg-background">
        {children}
        <footer className="mt-16 border-t border-border-subtle bg-surface-muted">
          <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-ink">
            <p className="font-medium text-foreground">Shop — prototype</p>
            <p className="mt-2 max-w-2xl">
              Browsing, search, product pages, cart and a simulated checkout are built.
              Product comparison and AI-written explanations are not — they arrive in later
              steps, so you will not find buttons for them here.
            </p>
            <p className="mt-3">
              All products, prices, images and reviews are invented for this prototype.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
