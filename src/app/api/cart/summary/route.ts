import { NextResponse } from "next/server";
import { parseRequestedItems, priceCart } from "@/server/pricing";

/** Prices a cart from the server catalog. The browser sends variant ids and
 *  quantities; everything else in the response is computed here. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const requested = parseRequestedItems(body);
  if (!requested) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const priced = await priceCart(requested);
  return NextResponse.json(priced);
}
