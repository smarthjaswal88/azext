import { NextResponse } from "next/server";
import { comparisonGroupOf, sharedComparisonGroup } from "@/lib/comparison-group";
import { imagesForColor } from "@/lib/product";
import { getProductsBySlugs } from "@/server/catalog";

/** Minimal records for the comparison tray: enough to draw a thumbnail and a
 *  name, nothing more. The tray stores only slugs, so titles and images are
 *  resolved here rather than kept in browser storage where they could go
 *  stale.
 *
 *  The comparison-group rule is enforced here too. The selection control
 *  already prevents a mixed set, but an endpoint that will happily describe one
 *  is an endpoint that says the rule is advisory. */
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

  const group = sharedComparisonGroup(products);
  if (products.length > 0 && !group) {
    return NextResponse.json(
      { error: "mixed_comparison_group" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    group: group ?? null,
    items: products.map((product) => {
      const firstColor = product.optionAxes.find((a) => a.key === "color")?.values[0];
      const image = imagesForColor(product, firstColor?.id)[0];
      return {
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        group: comparisonGroupOf(product),
        imageSrc: image.src,
        imageAlt: image.alt,
      };
    }),
  });
}
