import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shopping storefront with optional AI product comparison.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
