import { NextResponse } from "next/server";
import { createDemoOrder } from "@/server/orders";
import { parseRequestedItems, priceCart } from "@/server/pricing";

/** Places a demo order.
 *
 *  Totals are recomputed here from the catalog and the recomputed values are
 *  what get stored — anything the browser claimed about price is ignored.
 *  Idempotency is enforced in the database, so a double click or a retry
 *  returns the first order rather than creating a second. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const requested = parseRequestedItems(body);
  const idempotencyKey = (body as { idempotencyKey?: unknown })?.idempotencyKey;

  if (!requested || typeof idempotencyKey !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return NextResponse.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }

  const priced = await priceCart(requested);
  if (priced.lines.filter((l) => l.available).length === 0) {
    return NextResponse.json(
      { error: "nothing_purchasable", issues: priced.issues },
      { status: 400 },
    );
  }

  const result = await createDemoOrder(idempotencyKey, priced);

  if (result.status === "unconfigured") {
    return NextResponse.json(
      { error: "storage_unconfigured", missing: result.missing },
      { status: 503 },
    );
  }
  if (result.status === "error") {
    return NextResponse.json({ error: "storage_error", message: result.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      confirmationToken: result.confirmationToken,
      // Echoed back for display only; the stored values are the ones above.
      totalCents: priced.totalCents,
      purchasedVariantIds: priced.lines.filter((l) => l.available).map((l) => l.variantId),
    },
    { status: 201 },
  );
}
