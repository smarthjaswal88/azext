import type { Metadata } from "next";
import { CompareTray } from "@/components/compare-tray";
import { InlineScript } from "@/components/inline-script";
import { SiteFooter } from "@/components/site-footer";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vetra — Compare real product data. Decide with confidence.",
    template: "%s · Vetra",
  },
  description:
    "Vetra is a product decision prototype: compare real product data side by side, up to three products at a time, and decide with confidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The inline script sets data-theme before the first paint, so the
    // server's markup and the DOM differ on <html> by design.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <SiteFooter />
        <CompareTray />
      </body>
    </html>
  );
}
