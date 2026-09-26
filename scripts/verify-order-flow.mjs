/**
 * End-to-end checks for the order flow, against a running server and a real
 * Supabase database.
 *
 *   npm run build && npm start        # in one terminal
 *   npm run verify:orders             # in another
 *
 * Exits 2 (not 1) when Supabase is not configured, so "blocked" is never
 * mistaken for "passed".
 *
 * Confirmation tokens are secrets: they are the only thing standing between a
 * stranger and someone's order. This script never prints one in full and never
 * writes one to a file.
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

// Next loads .env itself; a standalone script has to.
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
    if (v && !process.env[k.trim()]) process.env[k.trim()] = v;
  }
}

/** Never log a token in full. */
const mask = (t) =>
  typeof t === "string" && t.length > 0 ? `${t.slice(0, 6)}…(${t.length} chars)` : String(t);

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
};

const postOrder = (items, idempotencyKey) =>
  fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, idempotencyKey }),
  });

/**
 * One purchasable option each from clothing and headphones, read from the
 * live catalog API, with the prices the server will charge. The expected
 * totals therefore come from the same catalog the order route prices from.
 */
async function pickVariant(category) {
  const list = await (await fetch(`${BASE}/api/catalog/products?category=${category}&limit=1`)).json();
  const slug = list.products?.[0]?.slug;
  if (!slug) throw new Error(`No ${category} products in the live catalog.`);
  const { product } = await (await fetch(`${BASE}/api/catalog/products/${slug}`)).json();
  const variant =
    product.variants.find((v) => v.isDefault && v.priceCents !== null) ??
    product.variants.find((v) => v.priceCents !== null);
  if (!variant) throw new Error(`${slug} has no priced option.`);
  return variant;
}

const usd = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

let ITEMS_A;
let ITEMS_B;
let EXPECTED_SUBTOTAL;
let CLOTHING_ID;

async function main() {
  const clothing = await pickVariant("clothing");
  const headphones = await pickVariant("headphones");
  CLOTHING_ID = clothing.id;
  ITEMS_A = [
    { variantId: clothing.id, quantity: 2 },
    { variantId: headphones.id, quantity: 1 },
  ];
  // Different contents under the same key, for the conflict check.
  ITEMS_B = [{ variantId: headphones.id, quantity: 1 }];
  EXPECTED_SUBTOTAL = 2 * clothing.priceCents + headphones.priceCents;

  const probe = await postOrder(ITEMS_A, `probe-${crypto.randomUUID()}`);
  if (probe.status === 503) {
    console.log("\nBLOCKED: Supabase is not configured, so the order flow cannot be tested.");
    console.log("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY, apply");
    console.log("supabase/migrations/, restart the server, and run this again.\n");
    process.exit(2);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  console.log("\n1. Successful order creation");
  const keyA = crypto.randomUUID();
  const createRes = await postOrder(ITEMS_A, keyA);
  const created = await createRes.json();
  check("returns 201", createRes.status === 201, `got ${createRes.status}`);
  check('outcome is "created"', created.outcome === "created", `got ${created.outcome}`);
  check("returns a confirmation token", typeof created.confirmationToken === "string");
  console.log(`        token: ${mask(created.confirmationToken)}`);

  const { data: row } = await admin
    .from("orders")
    .select(
      "subtotal_cents, shipping_cents, total_cents, currency, order_items(variant_id, quantity, unit_price_cents, line_total_cents)",
    )
    .eq("idempotency_key", keyA)
    .single();

  check(
    "persisted subtotal is server-calculated",
    row?.subtotal_cents === EXPECTED_SUBTOTAL,
    `stored ${row?.subtotal_cents}, expected ${EXPECTED_SUBTOTAL}`,
  );
  check(
    "persisted total = subtotal + shipping",
    row?.total_cents === row?.subtotal_cents + row?.shipping_cents,
  );
  check("persisted both items", row?.order_items?.length === 2, `got ${row?.order_items?.length}`);
  const tee = row?.order_items?.find((i) => i.variant_id === CLOTHING_ID);
  check(
    "line total = unit price x quantity",
    tee?.line_total_cents === tee?.unit_price_cents * tee?.quantity,
  );
  check("quantity persisted as sent", tee?.quantity === 2, `got ${tee?.quantity}`);

  console.log("\n2. Confirmation retrieval after refresh");
  const first = await fetch(`${BASE}/order/${created.confirmationToken}`);
  const firstHtml = await first.text();
  check("confirmation page returns 200", first.status === 200, `got ${first.status}`);
  check("shows the order total", firstHtml.includes(usd(row?.total_cents ?? EXPECTED_SUBTOTAL)));
  const second = await fetch(`${BASE}/order/${created.confirmationToken}`, { cache: "no-store" });
  const secondHtml = await second.text();
  check("still 200 on a second load (refresh)", second.status === 200);
  check(
    "same items shown on reload",
    secondHtml.includes("Fieldhouse") && secondHtml.includes("Verso"),
  );

  console.log("\n3. Two concurrent submissions, same key, same payload");
  const keyC = crypto.randomUUID();
  const [r1, r2] = await Promise.all([postOrder(ITEMS_A, keyC), postOrder(ITEMS_A, keyC)]);
  const [b1, b2] = await Promise.all([r1.json(), r2.json()]);
  check("both requests succeed", r1.ok && r2.ok, `got ${r1.status} and ${r2.status}`);
  check("both return the same confirmation token", b1.confirmationToken === b2.confirmationToken);
  check(
    "exactly one reports created",
    [b1.outcome, b2.outcome].filter((o) => o === "created").length === 1,
    `outcomes: ${b1.outcome}, ${b2.outcome}`,
  );
  const { data: orderRow } = await admin
    .from("orders")
    .select("id")
    .eq("idempotency_key", keyC)
    .single();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("idempotency_key", keyC);
  check("exactly one row in the database", count === 1, `found ${count}`);
  const { count: itemCount } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderRow?.id);
  check("items inserted once, not twice", itemCount === 2, `found ${itemCount}`);

  console.log("\n4. Same key, different payload");
  const conflictRes = await postOrder(ITEMS_B, keyC);
  const conflictBody = await conflictRes.json();
  const otherToken = b1.confirmationToken ?? "no-token";
  check("refused with 409", conflictRes.status === 409, `got ${conflictRes.status}`);
  check("no confirmation token disclosed", conflictBody.confirmationToken === undefined);
  check(
    "does not leak the other order's token",
    !JSON.stringify(conflictBody).includes(otherToken),
  );
  const { count: stillOne } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("idempotency_key", keyC);
  check("no extra order created", stillOne === 1, `found ${stillOne}`);

  console.log("\n5. Unknown confirmation tokens");
  for (const bad of [crypto.randomUUID(), "a".repeat(43), "../../etc/passwd", "x"]) {
    const res = await fetch(`${BASE}/order/${encodeURIComponent(bad)}`);
    const html = res.status === 200 ? await res.text() : "";
    check(
      `unknown token "${bad.slice(0, 12)}…" returns no order data`,
      res.status === 404 ||
        (!html.includes("Order placed") && !html.includes("Confirmation reference")),
      `status ${res.status}`,
    );
  }

  console.log("\n6. Row-level security (anon cannot read orders)");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.log("  SKIP  NEXT_PUBLIC_SUPABASE_ANON_KEY not set — RLS check not run");
  } else {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey, {
      auth: { persistSession: false },
    });
    const { data: leaked, error } = await anon.from("orders").select("confirmation_token");
    check(
      "anon role reads no orders",
      !!error || (leaked?.length ?? 0) === 0,
      error ? `blocked: ${error.message}` : `returned ${leaked?.length} rows`,
    );
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nverification aborted:", err.message);
  process.exit(1);
});
