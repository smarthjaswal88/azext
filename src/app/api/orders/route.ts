import { NextResponse } from "next/server";
import { createDemoOrder } from "@/server/orders";
import { warnIfUnconfigured } from "@/server/supabase";
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
    // The missing variable names go to the server log, not to the client. A
    // shopper cannot act on them, and a response body is readable by anyone.
    warnIfUnconfigured();
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }
  if (result.status === "error") {
    return NextResponse.json({ error: "storage_error", message: result.message }, { status: 500 });
  }
  if (result.status === "key_conflict") {
    // The key was already used for a different order. Returning that order
    // would tell this caller about a purchase they did not make, so nothing
    // about it is disclosed.
    return NextResponse.json({ error: "idempotency_key_conflict" }, { status: 409 });
  }

  return NextResponse.json(
    {
      confirmationToken: result.confirmationToken,
      // "created" on the first call, "reused" when an identical request
      // repeated. Both mean exactly one order exists.
      outcome: result.status,
      // Echoed back for display only; the stored values are the ones above.
      totalCents: priced.totalCents,
      purchasedVariantIds: priced.lines.filter((l) => l.available).map((l) => l.variantId),
    },
    { status: result.status === "created" ? 201 : 200 },
  );
}
