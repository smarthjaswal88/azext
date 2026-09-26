import type { Metadata } from "next";
import { CompareTray } from "@/components/compare-tray";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexus — discover, compare and decide",
    template: "%s · Nexus",
  },
  description:
    "Nexus is a product intelligence prototype: discover products, compare up to three side by side, and decide with real listing data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
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
