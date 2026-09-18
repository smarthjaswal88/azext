# Shop

A shopping storefront with an optional AI product comparison feature.

Shoppers browse, pick a product and check out directly. Alternatively they can compare up to
three products using specifications, ratings, review insights and their own stated preferences.

**Built so far:** a demo catalog, search with filtering and sorting, product detail pages, a
persisted cart, and a simulated checkout that records demo orders.
**Not built:** product comparison, AI explanations, authentication, real payment. You will not
find buttons for those — an absence is clearer than a control that does nothing.

All products, prices, images and reviews are invented for this prototype.

## Requirements

- Node.js 20.9+ (developed on v26)
- npm (the lockfile is `package-lock.json`; do not switch package manager)

## Local setup

```bash
npm install
cp .env.example .env.local   # optional — the placeholder app runs without it
npm run dev
```

Open http://localhost:3000.

No API credentials are required to run, lint, typecheck or build the app at this stage.

## Commands

| Command | What it does |
|---|---|
| `npm run check:cart` | Behavioural checks for the persisted cart store |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build (run `build` first) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Environment variables

`.env.example` lists every variable the project will need, split into two groups.

- **`NEXT_PUBLIC_*`** is inlined into the browser bundle at build time and is readable by
  anyone who opens the site. Only non-secret configuration belongs here.
- **Everything else** stays on the server and must only be read from route handlers or server
  components.

`DEEPSEEK_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only. They must never be given a
`NEXT_PUBLIC_` prefix, imported into a client component, logged, or returned in an API response.

Local env files are gitignored; `.env.example` is deliberately not.

## Supabase setup

Demo orders are stored in Supabase. **Without it the app runs and the whole catalog works, but
checkout is disabled and says so** — nothing is kept in memory as a stand-in, because an order
that disappeared on the next restart would look like it had worked.

1. Create a Supabase project.
2. Apply the migration in `supabase/migrations/0001_demo_orders.sql`, either with the Supabase
   CLI (`supabase db push`) or by pasting it into the SQL editor.
3. Put these in `.env.local` — copy the values from **Project Settings → API**:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

4. Restart `npm run dev`. Checkout enables itself once both are set.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is listed in `.env.example` for later steps. Order storage does
not use it.

### How orders stay private

Row-level security is enabled on both tables and **no policy is ever created**, so the `anon`
and `authenticated` roles can read nothing at all. Every read and write happens in server code
holding the service-role key, which bypasses RLS and never reaches the browser.

A guest reaches their own order through a confirmation token of 32 random bytes in the URL.
They cannot query the table, so they cannot enumerate or guess their way to anyone else's order.

## Architecture

Next.js App Router with TypeScript and Tailwind CSS v4.

```
src/app/
  layout.tsx            shell, footer, metadata
  globals.css           Tailwind entry point and theme tokens
  page.tsx              homepage
  not-found.tsx         404
  search/page.tsx       results, filters, sorting
  product/[slug]/       product detail
  cart/page.tsx         cart
  checkout/page.tsx     simulated checkout
  order/[token]/        order confirmation, readable after a refresh
  api/cart/summary/     prices a cart from the catalog
  api/orders/           places a demo order
src/components/         presentational pieces used by more than one page
src/lib/                types and pure helpers, safe on client or server
src/server/
  catalog.ts            the only way the app reads catalog data
  demo-data.ts          the demo catalog itself
  pricing.ts            turns variant ids and quantities into money
  orders.ts             demo order persistence
  supabase.ts           server-only Supabase access
supabase/migrations/    SQL for the orders tables
scripts/
  generate-product-images.py   generates everything in public/images/
```

`src/server/catalog.ts` is the seam. Every function is async and specific to what the
storefront asks for. Moving to Supabase means rewriting those function bodies; no page changes.
It is deliberately not a generic repository or query builder.

Backend work will use **Next.js route handlers** inside `src/app/`. There is no separate backend
service and none is planned. No placeholder API routes exist yet — they will be added when
something actually calls them.

Shared components, product types and server utilities will get their own directories under
`src/` at the point where there is real code to put in them, rather than being created empty now.

## Design decisions

Recon (see `recon/notes.md`) left real questions open. Rather than block, each was decided and
recorded here. These are our choices, not observations of any other retailer.

| Decision | Reasoning |
|---|---|
| Clothing varies by **colour and size**; headphones by **colour** only | Our design decision. No clothing product page was ever captured, so there was nothing to copy. |
| Variants, not products, carry **price and availability** | Recon did evidence per-variant pricing, and it is the only model that survives a size surcharge. |
| Money is **integer cents**, formatted once in `src/lib/format.ts` | Floats do not survive arithmetic on prices. |
| **Rating count and written-review count are separate** | Most people who rate never write anything. Collapsing them overstates written feedback. |
| Rating averages are **derived from the histogram** | The summary cannot contradict itself. |
| Reviews belong to a **product** and optionally name a purchased variant | Matches what recon showed: reviews pool across variants while keeping attribution. |
| Search, filter, sort and variant selection all live in **URL parameters** | Results are shareable, the back button works, and no client JavaScript is needed. |
| **No comparison or AI controls anywhere** | Those features do not exist yet. |
| The cart stores **only variant ids and quantities** | Prices are resolved server-side on every render. Nothing in localStorage can change what is charged. |
| Cart and quantity changes are **client state, not URL navigation** | Catalog pages keep state in the URL because it should be shareable. A cart edit is neither shareable nor a navigation. |
| Hydration uses **`useSyncExternalStore` with an undefined server snapshot** | A `hydrated` flag set from persist's rehydrate callback cannot work: with synchronous storage that callback runs while the store is still being created, so the flag never flips. |
| Buy now **never touches the cart** | It checks out one selection. Merging it into the cart, or clearing the cart, would both lose work the shopper did not ask to lose. |
| Order idempotency is enforced **in the database**, on a client-generated key | A unique constraint is the only thing that actually holds under concurrent double clicks. The key is stable across retries so a retry after a timeout resolves to the first order. |
| The cart is cleared **only after** an order is confirmed, and only of what was bought | Clearing first loses the cart if the write fails. |
| The popularity sort is called **"Most rated"** | It orders by number of ratings. Calling it "Featured" implied a merchandised ordering we do not have. |
| A product matches a price filter when **any variant** falls in range | The shopper can select that variant. |
| Specs reading "None" are **excluded from search text** | Otherwise searching "noise cancelling" returns every pair of headphones, including those that say "None". |

### Search behaviour, stated precisely

Terms are split on whitespace and AND-ed; each must appear in the product's title, brand,
summary, category or specifications, matched at a **word boundary with prefix matching**. So
"headphone" finds "headphones", and "open" finds "open-back" — but it also finds "opening",
which is the cost of prefix matching. There is no stemming, phrase matching, typo tolerance or
relevance ranking. It is a catalog filter, not a search engine.

### Still open

Checkout was never observed during recon, and no clothing product page was captured. Neither
blocks this step. Both are recorded in `recon/notes.md` §5.2b against the step that needs them.

### Planned sequence

| Step | Scope | Status |
|---|---|---|
| 1 | Scaffold: App Router, TypeScript, Tailwind, ESLint | done |
| 2a | Catalog, search, product details | done |
| 2b | Cart and simulated checkout | done |
| 3 | Optional comparison for up to three products | not started |
| 4 | Review-confidence and personal-suitability explanations via DeepSeek | not started |

Comparison is a core feature of the submission, but it stays optional in the shopper journey:
browse → product → checkout must always work without it.

Review confidence (how strongly the review evidence supports a conclusion) and personal
suitability (how well a product fits this shopper's stated preferences) are two separate
assessments and are kept structurally separate throughout.

## Demo data and images

Everything in `src/server/demo-data.ts` is invented: brands are fictional and were chosen not to
resemble real ones, and the reviews are written content, not customer feedback. The storefront
says so on every page — a banner in the header and a notice above the reviews.

Every image in `public/images/` is an SVG generated by `scripts/generate-product-images.py`.
Nothing was downloaded or derived from a third-party image, so the set carries no attribution or
licence obligation. See `public/images/README.md`.

## Exploration notes

`recon/` holds the Amazon shopper-experience reference material — redacted screenshots and
written observations — along with an explicit record of which flows were never observed. Open
product questions are routed there to the implementation step that needs them.
