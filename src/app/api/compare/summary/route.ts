import { NextResponse } from "next/server";
import { imagesForColor } from "@/lib/product";
import { getProductsBySlugs } from "@/server/catalog";

/** Minimal records for the comparison tray: enough to draw a thumbnail and a
 *  name, nothing more. The tray stores only slugs, so titles and images are
 *  resolved here rather than kept in browser storage where they could go
 *  stale. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slugs = (body as { slugs?: unknown })?.slugs;
  if (!Array.isArray(slugs) || slugs.length > 10) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const products = await getProductsBySlugs(
    slugs.filter((s): s is string => typeof s === "string"),
  );

  return NextResponse.json({
    items: products.map((product) => {
      const firstColor = product.optionAxes.find((a) => a.key === "color")?.values[0];
      const image = imagesForColor(product, firstColor?.id)[0];
      return {
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        category: product.category,
        imageSrc: image.src,
        imageAlt: image.alt,
      };
    }),
  });
}
