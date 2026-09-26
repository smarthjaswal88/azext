# Nexus

Nexus is an independent product discovery and decision platform. People discover products,
compare up to three side by side, can ask an optional AI **Decision Assistant** how the options
fit what they need, and can try a **demo** order flow.

- **Live data.** Every product fact on the site — price, previous price, rating, rating count,
  availability, features, specifications and options — comes from a catalog stored in
  **Supabase**. There is no static or fallback product data in the interface; when the catalog
  cannot be read, the page says so.
- **One-time import.** The catalog was populated once from a Bright Data dataset of public
  retailer listings. Bright Data is used **only** for that operator-run import; the running site
  never calls it.
- **Decision Assistant.** Uses only live catalog fields: rating, rating count, pricing,
  specifications and features. It does **not** use individual customer review text — none was
  imported. It is **off by default**.
- **Demo checkout.** The cart and checkout are a demo order flow. **No payment is taken and
  nothing ships.** Placing an order writes a demo order record and nothing else.

Not built: accounts, real payment, fulfilment.

## Pages

| Route | What it is |
|---|---|
| `/` | Discover: hero with live catalog stats, a category explorer, search and filters (category, product type, brand, price, rating, sort) and the product grid |
| `/product/[slug]` | A product: image, price and previous price, rating and rating count, availability, features, specifications, priced options, compare, "View source" and add to the demo cart. Unknown slugs return HTTP 404 |
| `/compare` | The decision board for up to three products from one category, with the Decision Assistant |
| `/cart`, `/checkout` | The demo order flow, priced on the server |
| `/order/[token]` | A demo order confirmation, reachable only by its token |
| `/search` | Redirects to `/`, keeping the query, category, price and sort of old links |

## Requirements

- Node.js 20.9+ (developed on v26)
- npm (the lockfile is `package-lock.json`; do not switch package manager)
- A Supabase project with the migrations below applied

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the names listed under "Environment variables"
npm run dev
```

Open http://localhost:3000. Without Supabase the pages still build and render, but the catalog
routes answer `503 catalog_unconfigured` and every page shows an honest error state instead of
products.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build (run `build` first) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:cart` | Behavioural checks for the persisted cart store |
| `npm run verify:orders` | End-to-end order-flow checks against a running server and Supabase. **Creates real demo order rows** |
| `npm run catalog:fields` | Operator only: free schema check against the Bright Data dataset metadata |
| `npm run catalog:preview` | Operator only: shows the exact import request; sends nothing |
| `npm run catalog:import` | Operator only: the one-time paid import (needs `--confirm`) |
| `npm run catalog:resume` | Operator only: finishes an import from its existing snapshot |

## Environment variables

Names only — values are never written in this repository. `.env.example` lists them with empty
values; local env files are gitignored.

- **`NEXT_PUBLIC_*`** is inlined into the browser bundle at build time and is readable by anyone.
  Only non-secret configuration belongs there.
- **Everything else** is server-only: read in route handlers and server code, never imported into
  a client component, never logged, never returned in a response.

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | catalog, checkout, AI ledger | The project URL itself, **not** the REST endpoint — a URL ending in `/rest/v1/` makes every catalog query fail with `PGRST125` |
| `SUPABASE_SECRET_KEY` | everything that reads Supabase | The `sb_secret_…` key. Server-only |
| `SUPABASE_SERVICE_ROLE_KEY` | as above | Legacy name, still accepted; `SUPABASE_SECRET_KEY` wins if both are set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `verify:orders` only | Lets the script confirm the anon role can read nothing. The app does not use it |
| `AI_LIVE_REQUESTS` | Decision Assistant | The master switch. Leave unset; only the exact value `enabled` allows paid requests |
| `DEEPSEEK_API_KEY` | Decision Assistant | Server-only. Not enough on its own to spend |
| `AI_VISITOR_SALT` | Decision Assistant rate limits | Salt for the visitor hash |
| `BRIGHT_DATA_API_TOKEN` | one-time import only | Server-only. **Never set it in a deployment** |
| `BRIGHT_DATA_DATASET_ID` | one-time import only | The import refuses any dataset other than the authorized one |
| `CATALOG_IMPORT_SECRET` | one-time import only | Enables the protected import route locally. **Never set it in a deployment** |
| `CATALOG_IMPORT_ALLOW_PRODUCTION` | one-time import only | Leave unset; the import route is disabled in production builds without it |
| `CATALOG_IMPORT_BASE_URL`, `VERIFY_BASE_URL` | operator scripts | Optional; default to `http://localhost:3000` |

## Supabase setup

Apply the migrations in the **SQL Editor**, in order, one whole file per query (the function
bodies contain semicolons, so never run them statement by statement):

| Migration | Creates | Needed for |
|---|---|---|
| `0001_demo_orders.sql` | `orders`, `order_items`, `create_demo_order` | demo checkout |
| `0002_idempotency_fingerprint.sql` | `request_fingerprint`, `create_demo_order_v2` | demo checkout |
| `0003_ai_guidance.sql` | `ai_budget`, `ai_usage`, `ai_guidance_cache` and their functions | Decision Assistant |
| `0004_budget_limit_and_dedup.sql` | a $0.50 spend ceiling and in-flight de-duplication | Decision Assistant |
| `0005_catalog.sql` | `catalog_products`, `catalog_variants`, `catalog_specifications`, `catalog_sync_runs`, `upsert_catalog_product` | the catalog — required |

Every table has row-level security on and **no policies**, and table privileges are revoked
from `anon` and `authenticated`. All reads and writes happen in server code holding the secret
key. `0005` is wrapped in a transaction and safe to re-run.

**Do not use the publishable key** (`sb_publishable_…`) where the secret key belongs. It is a
valid key, so nothing fails loudly — but it does not bypass RLS, so every read comes back empty.
The server checks the prefix and refuses it, logging the reason without logging the key.

### Idempotency, precisely

A checkout attempt generates one key and reuses it across retries.

| Case | Result |
|---|---|
| Same key, same request | The original order and its token. Exactly one order exists. |
| Same key, different request | **409, and no token is returned.** |
| New key | A new order. |

Orders store a fingerprint of the request each key was first used for, built from the
server-recomputed lines and totals. Returning the earlier order in the middle case would show a
purchase the caller did not just make.

### How orders stay private

A guest reaches their own order through a 43-character confirmation token (32 random bytes) in
the URL. With RLS denying the anon role outright, no one can query the tables, so no one can
enumerate or guess their way to another order.

`npm run verify:orders` checks creation and persisted totals, confirmation after a refresh,
concurrent submissions with one key, key reuse with a different payload and unknown tokens. It
takes one clothing and one headphone option from the live catalog API, so expected totals come
from the same source the server prices from. It exits 2 when Supabase is not configured and never
prints a token in full.

## The live catalog

**Tables.** `catalog_products` holds one row per product (price in integer cents, previous
price, rating, rating count, availability, image URL, source URL, category, product type and a
full-text search vector). `catalog_variants` holds its options — exactly one default option per
product, plus the source's variations; an option without a listed price has a null price and is
never purchasable. `catalog_specifications` holds specification rows and feature bullets.
`catalog_sync_runs` records each import as counts and codes only.

**API routes.** Supabase only, no static fallback. Server-side reads use the secret key; nothing
reaches the browser except the shaped JSON below.

| Route | Returns |
|---|---|
| `GET /api/catalog/products` | A page of product summaries and the total. Parameters: `q`, `category`, `brand`, `minPrice` and `maxPrice` (integer cents), `sort` (`featured` = most rated, `price-asc`, `price-desc`, `rating-desc`), `limit` (1–48, default 24), `offset` |
| `GET /api/catalog/products/[slug]` | One product with its options, specifications and feature bullets |
| `GET /api/catalog/categories` | Categories with product counts, product types, brands and price range |

Malformed parameters are a 400 listing the reasons. Successful responses carry a short shared
cache (`s-maxage=60`).

**Search** is Postgres full-text search (English stemming, web-search syntax) over title, brand
and description; every term must match. Category and brand match exactly. The API has no
product-type or rating filter, so the discovery page loads the full matching set and applies
those two in the browser.

## One-time catalog import (Bright Data)

The catalog was filled by a single operator-run collection from Bright Data's "Amazon products —
discover by keyword" dataset: four keywords (wireless headphones, over ear headphones, cotton t
shirt, linen shirt), at most 6 records each and 24 in total. The import run on 2026-09-26
delivered 21 records and imported 17 products. **Bright Data is not called by the running site**;
nothing in the interface or the catalog API depends on it.

```bash
npm run dev                                                  # terminal 1
npm run catalog:fields                                       # free schema check, no collection
npm run catalog:preview                                      # prints the exact request; sends nothing
npm run catalog:import -- --confirm IMPORT_MAX_24_PRODUCTS   # the one paid request, then imports
npm run catalog:resume -- <run-id> [--reimport]              # finish from the existing snapshot
```

Safeguards:

- The import route `/api/admin/catalog/import` answers 404 unless `CATALOG_IMPORT_SECRET` is set
  (32+ characters), and 404 in production builds unless `CATALOG_IMPORT_ALLOW_PRODUCTION=true` too.
- `catalog:import` prints the exact endpoint, payload, limits and assumptions first and sends
  nothing without `--confirm`. The server re-reads the dataset's metadata (free) and refuses to
  send the paid request if any requested field is missing from the schema.
- Each run is recorded before Bright Data is contacted. The database refuses a run asking for more
  than 6 per keyword or 24 in total, and refuses a second concurrent run. After a run Bright Data
  accepted — or may have — another start must name that run with
  `--authorize-additional-paid-run <run-id>`.
- Only 21 confirmed fields are requested (`custom_output_fields`), so review text, reviewer data
  and seller data are never delivered. The normalizer (`src/server/brightdata/normalize.ts`) never
  fills a missing value and skips any record without an ASIN, a product URL, a title or a USD
  price. Products are classified from their title and category fields; anything ambiguous or
  off-topic is skipped with a reason. Image URLs are stored only for the source's https image
  CDN; no image is downloaded.

## Demo checkout

- Browser storage holds only variant ids and quantities. `/api/cart/summary` and `/api/orders`
  price every line on the server from `catalog_variants` (`src/server/pricing.ts`); nothing the
  browser says about money is read.
- Only options with a listed USD price that are not out of stock can be selected or ordered. An
  unpriced option is shown as unavailable and excluded from every total — it never borrows the
  parent's price.
- Delivery details are fixed demo values; nothing about the shopper is collected. There is no
  payment provider, no card form and no charge, and nothing is shipped. Every step of the flow
  says so.
- The cart is cleared only after an order is confirmed, and only of what was ordered.

## Decision Assistant

On the compare page a shopper writes what matters to them ("comfortable headphones for the gym,
under $100"), and the assistant weighs the selected products — up to three, from one category —
against that need. The comparison works the same whether it is used, loading, failed or switched
off.

**What it is given.** Per product, loaded from Supabase on the server by slug or id
(`src/server/ai/context.ts`): title, brand, category, product type, price, previous price, rating,
rating count, availability, a budget check computed in code, up to 8 features, up to 24
specifications and up to 8 priced options. It is **not** given review text (none exists), images,
URLs or seller data.

**What it returns.** Structured JSON: a recommended product or "no clear recommendation", a short
reason, supporting evidence tied to specific listing fields, tradeoffs, parts of the need no field
addresses, a confidence level and a fixed limitation statement: *"Recommendation based on
available catalog details, rating, and rating count. Individual customer review text was not
imported."*

### Keeping it honest

- The need and all listing text travel as JSON the system prompt identifies as **data, not
  instructions**.
- Evidence must cite a field reference (`price`, `ratingCount`, `feature:3`, `spec:Item Weight`,
  `option:2`, …). References to fields the listing does not have are dropped, and **the value
  shown beside each note is looked up from the catalog on the server** — a displayed value can
  never be one the model invented. What that does not establish: whether the field bears on the
  need, or whether the note reads it fairly. That is why the value is always shown with the note.
- Budgets are parsed from the need and compared in integer cents in code; the model is handed
  booleans.
- Output failing validation is reported as an error; canned text is never shown as an answer.

### Confidence is computed, not asked for

Fixed rules in `src/server/ai/confidence.ts`, with thresholds in `src/lib/guidance.ts` so the
panel's explanation cannot drift from the code. The model is told not to produce a confidence
level and none it gives is read.

| Level | When |
|---|---|
| High | at least 3 distinct listing fields cited in support, at least 1,000 ratings, and no part of the need reported as unaddressed |
| Medium | at least 1 supporting field and at least 50 ratings, but not enough for High |
| Low | no recommendation; a thin listing (fewer than 3 specifications and fewer than 3 features); products too similar to separate (same type, prices within 5%, ratings within 0.1); a price above the stated budget; or too little evidence |

A supporting field counts only if it exists in that product's listing. The only model output that
affects the level is the list of unaddressed needs, and it can only lower confidence.

### Spend controls

Paid requests stay off until **all** of these hold: `AI_LIVE_REQUESTS` equals `enabled`,
`DEEPSEEK_API_KEY` is set, Supabase is configured, and `ai_budget` has a row (migrations
`0003`/`0004` leave it at **$0.50**). On top of that:

- **Called only when "Ask the decision assistant" is pressed** — never on load or while typing.
  The panel asks `GET /api/guidance` for a boolean only and keeps the button disabled when live
  requests are off.
- **Two gates on the switch.** The route refuses before doing any work, and the DeepSeek client
  (`src/server/ai/deepseek.ts`) re-checks it and refuses to send.
- **One attempt, no retries**, a 25-second timeout, `max_tokens` 900, thinking disabled, JSON
  output (`deepseek-flash`, checked against DeepSeek's published documentation).
- **Capped requests**: 1–3 products from one category, a need of 3–280 characters, bodies over
  8 KB rejected. Three products make a prompt of roughly 12,000 characters, reserved at about
  $0.003.
- **Cached** under a fingerprint of the model, prompt version, a SHA-256 of the exact evidence
  sent, the products and the normalised need. An identical question is never paid for twice, and
  a re-import that changes any listing is a new question.
- **Concurrent duplicates refused** inside the same SQL function that reserves budget, so the
  check and the reservation cannot interleave.
- **Per-visitor rate limits**: 6 per hour, 20 per day, keyed by a salted hash; no IP or user agent
  is stored.

**How the budget works, and what it does not guarantee.** Cost is tracked in integer
micro-dollars. Each call first reserves the bounded input plus the full output ceiling at peak,
cache-miss prices, then settles to the reported usage. Failures keep their reservation unless the
request never left the process. It bounds spend; it is not a financial guarantee — it relies on
published prices and reported token counts, and only knows about requests made through this
route. Inspect it with `select public.ai_budget_status();` and change the ceiling with
`select public.ai_set_budget_limit(<micros>);`.

### Turning it on

Off by default. In the host's environment settings (on Vercel: Project → Settings → Environment
Variables) set `AI_LIVE_REQUESTS` to `enabled` and a server-only `DEEPSEEK_API_KEY`, make sure
migrations `0003` and `0004` are applied, and redeploy. While it is off, the compare page says so,
explains these steps, and makes no request.

## Deploying to Vercel

A standard Next.js App Router project: Vercel's framework preset handles the build and there is
no `vercel.json`. `engines.node` in `package.json` pins Node 20.9+, and `.vercelignore` keeps
`recon/`, `.agent-logs/`, `CAPTURE-TEST.md`, `scripts/` and `supabase/` out of the upload.

Product images load directly from the source's image CDN through `next/image` with `unoptimized`
and `referrerPolicy="no-referrer"`: nothing is proxied, resized or stored, and no image
optimization is used.

**Set** `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` (both are needed before the build
runs, since the first is inlined). Set `AI_VISITOR_SALT` and `DEEPSEEK_API_KEY` only when
enabling the assistant, and leave `AI_LIVE_REQUESTS` unset until then. **Never set**
`BRIGHT_DATA_API_TOKEN`, `BRIGHT_DATA_DATASET_ID`, `CATALOG_IMPORT_SECRET` or
`CATALOG_IMPORT_ALLOW_PRODUCTION` in a deployment. The Supabase project must have migrations
`0001`, `0002` and `0005` applied (and `0003`/`0004` for the assistant).

### Things to weigh before making it public

- There is no authentication and no rate limit on demo order creation.
- Product titles, descriptions and images are third-party listing content, and images are loaded
  from the source's CDN. Whether that is acceptable for a public site is a decision for the owner.
- Prices and stock are as of the import and may have changed; every product links to its source.

## Architecture

Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase, zustand for the two browser stores.

```
src/app/
  page.tsx                   Discover
  product/[slug]/page.tsx    product page (server lookup, 404 for unknown slugs)
  compare/page.tsx           decision board
  cart/, checkout/, order/[token]/   demo order flow
  search/page.tsx            redirect to /
  api/catalog/               products, products/[slug], categories — the live catalog API
  api/cart/summary/          prices a cart from the catalog
  api/orders/                places a demo order
  api/guidance/              the Decision Assistant (GET availability, POST ask)
  api/admin/catalog/import/  the protected, operator-only import route
  api/compare/summary/       LEGACY — see below
src/components/              shell, product card, meta, image, UI primitives
  discovery/ product/ compare/   page-specific components
src/lib/                     client-safe code: API contracts (catalog-api, guidance), the catalog
                             client and hooks, compare selection and insights, discovery
                             filters, cart store, formatting
src/server/
  catalog-db.ts              every Supabase catalog read
  pricing.ts, orders.ts      server-side pricing and demo orders
  supabase.ts                server-only client
  ai/                        Decision Assistant context, prompt, validation, confidence, spend
  brightdata/, catalog-import.ts   the one-time import
supabase/migrations/         0001–0005
scripts/                     cart check, order-flow check, import operator command
```

## Design decisions

| Decision | Reasoning |
|---|---|
| Live catalog only; a failed read is shown as a failure | Stand-in data would look like real listings. |
| Money is integer cents, formatted in `src/lib/format.ts` | Floats do not survive arithmetic on prices. |
| The cart stores only variant ids and quantities | Every price is resolved on the server, so nothing in browser storage can change what is charged. |
| Only priced, in-stock options are selectable | An option without a price cannot be ordered honestly, and its price is never borrowed from another. |
| Products are compared within one category; adding another asks first | A t-shirt and headphones share no meaningful rows, and silently discarding a shortlist is worse than one extra click. |
| Comparison insights, signals, differences and tradeoffs are computed from listing data | They say what they are computed from, report ties as ties, and are never AI output. |
| Discovery filters live in the URL | Results are shareable and the back button steps through changes. |
| Unknown product URLs are a real 404 | The page looks the product up on the server before rendering. |
| Order idempotency is enforced in the database and bound to a request fingerprint | A unique constraint is what holds under concurrent double clicks; the fingerprint stops a reused key returning an unrelated order. |
| Configuration problems are server diagnostics | Visitors cannot act on a missing variable, and response bodies are public. |
| Hydration uses `useSyncExternalStore` with an undefined server snapshot | Server and client markup match, and a returning visitor is never shown an empty cart. |
| A description that only repeats the feature bullets is not shown twice | Presentation only; stored text is never edited. |

## Legacy code

Kept so that no existing route breaks, and not used by the Nexus interface:

- **`/api/compare/summary`** serves the retired static demo catalog. Nexus reads the live catalog
  through `/api/catalog/*` instead. Its data — `src/server/catalog.ts`, `src/server/demo-data.ts`,
  `src/lib/product.ts`, `src/lib/comparison-group.ts`, the static parts of `src/lib/types.ts`,
  `public/images/` and `scripts/generate-product-images.py` — is read by nothing else, and can be
  deleted together with the route.
- **`recon/`** holds research notes and screenshots from the project's early exploration phase.
  The app does not use it, and it is excluded from deployments.

## Known limitations

- The Decision Assistant is built and tested with live requests off; its first live answer has
  not yet been observed.
- If Supabase cannot be read, a product page falls back to loading in the browser and shows an
  error with a retry (HTTP 200) rather than a 404.
- Product type and rating filters run in the browser because the catalog API does not take them.
- Imported data carries source quirks: near-duplicate listings of one product in different colours
  or packs, and occasional leftover retailer page text in descriptions.
