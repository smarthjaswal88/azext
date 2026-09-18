# Shop

A shopping storefront with an optional AI product comparison feature.

Shoppers browse, pick a product and check out directly. Alternatively they can compare up to
three products using specifications, ratings, review insights and their own stated preferences.

**Built so far:** a demo catalog, search with filtering and sorting, product detail pages, a
persisted cart, a simulated checkout that records demo orders, optional product comparison, and
optional DeepSeek-written guidance inside that comparison.
**Not built:** authentication, real payment.

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
| `npm run verify:orders` | End-to-end order-flow checks; needs a running server and Supabase |
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
2. Apply **both** migrations in `supabase/migrations/`, in order, either with the Supabase CLI
   (`supabase db push`) or by pasting them into the SQL editor:
   - `0001_demo_orders.sql` — tables, RLS, the order-creation function
   - `0002_idempotency_fingerprint.sql` — binds an idempotency key to the request it was first
     used for (additive; safe to apply on top of 0001)
   - `0003_ai_guidance.sql` — AI spend budget, usage ledger and guidance cache
3. Put these in `.env.local` — copy the values from **Project Settings → API**:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

4. Restart `npm run dev`. Checkout enables itself once both are set.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is listed in `.env.example` for later steps. Order storage does
not use it.

### Verifying it works

With the server running and Supabase configured:

```bash
npm run verify:orders
```

It checks order creation and persisted totals, confirmation retrieval after a refresh,
concurrent submissions with one key, key reuse with a different payload, unknown tokens, and —
if `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set — that the anon role can read nothing. It exits 2 when
Supabase is not configured, so "blocked" is never mistaken for "passed", and it never prints a
confirmation token in full.

### Idempotency, precisely

A checkout attempt generates one key and reuses it across retries.

| Case | Result |
|---|---|
| Same key, same request | The original order and its token. Exactly one order exists. |
| Same key, different request | **409, and no token is returned.** |
| New key | A new order. |

The middle row is why orders store a fingerprint of the request the key was first used for.
Returning the earlier order there would tell the caller "done" and show them a purchase they
did not just make.

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
  compare/page.tsx      optional comparison, up to three products
  checkout/page.tsx     simulated checkout
  order/[token]/        order confirmation, readable after a refresh
  api/cart/summary/     prices a cart from the catalog
  api/compare/summary/  thumbnails and names for the comparison tray
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
| A key is **bound to a request fingerprint** | Without it, reusing a key for different contents silently returns an unrelated order. The fingerprint is built from server-recomputed lines and totals, so a client cannot forge a match. |
| Configuration problems are **server diagnostics, not UI** | A shopper cannot act on a missing environment variable, and a response body is readable by anyone. The page says checkout is unavailable; the server log names the variables. |
| The cart is cleared **only after** an order is confirmed, and only of what was bought | Clearing first loses the cart if the write fails. |
| The popularity sort is called **"Most rated"** | It orders by number of ratings. Calling it "Featured" implied a merchandised ordering we do not have. |
| A product matches a price filter when **any variant** falls in range | The shopper can select that variant. |
| Specs reading "None" are **excluded from search text** | Otherwise searching "noise cancelling" returns every pair of headphones, including those that say "None". |

### Comparison

Optional throughout: every product can be bought from its own page without ever opening it.

**Comparison groups**, which decide what may be compared with what:

| Group | Holds | Products |
|---|---|---|
| `personal-audio` | headphones and earbuds | 6 |
| `shirts-and-tops` | shirts and tees | 3 |
| `knitwear-and-layers` | sweaters and fleeces | 2 |
| `trousers` | trousers | 1 |

The group is a field on the product (`Product.comparisonGroup`), not something
inferred from the category at the point of use, so there is one definition. Note that
`trousers` currently holds a single product: the selection control explains that rather than
offering a comparison that cannot happen.

| Decision | Reasoning |
|---|---|
| Up to **three products, one comparison group** | Groups are finer than categories, because "clothing" is not a comparable set — a chino and a t-shirt share almost no specification rows, so the table would be mostly "Not provided". |
| The group rule is enforced in **four places** | The selection control, the comparison page's URL parsing, the tray summary endpoint and the AI endpoint. Any one of them alone can be bypassed. |
| A mixed URL **asks**, it does not pick | Quietly dropping half of a link and showing the rest as though it were the request is worse than asking. The page lists what the link contains and offers each group as a choice. The AI endpoint refuses outright, since a mixed set there means the caller is not the UI. |
| A group holding **one product** says so | The control explains that there is nothing to compare against rather than offering a button that can never reach two columns. Trousers is such a group today. |
| A group clash **asks** rather than clearing | Silently discarding three considered choices because someone clicked the wrong thing is worse than one extra click. |
| The tray stores **only slugs** | Titles, images and prices are resolved server-side, so nothing in browser storage can go stale or be edited. |
| Selections live in the **URL** on the comparison page | A comparison can be bookmarked, shared and reopened. Invalid or unknown ids are dropped with a notice rather than trusted. |
| Clothing needs an **explicit size** before Add to cart | The size axis is never defaulted. Guessing a size on a shopper's behalf produces a wrong order. |
| Missing specifications read **"Not provided"** | Never a value borrowed from the neighbouring column, and never invented. |
| Review excerpts state **how many records actually exist** | The catalog holds three or four real review records per product while the aggregate figure is in the hundreds. The page says so rather than implying the aggregate was read. |

Two further row groups — "Review confidence" and "Match for your needs" — are planned for the
DeepSeek step. They are deliberately **not** stubbed out: an empty panel promising analysis that
does not exist would be worse than no panel.

## AI guidance

Optional, inside the comparison page only. Everything else — browsing, search, cart, checkout —
works whether or not it is switched on.

### Model, checked against the documentation

Verified against DeepSeek's own docs without calling the inference API:

| Checked | Source |
|---|---|
| Model IDs and prices | <https://api-docs.deepseek.com/quick_start/pricing> |
| Request and response fields | <https://api-docs.deepseek.com/api/create-chat-completion> |
| JSON output requirements | <https://api-docs.deepseek.com/guides/json_mode> |
| Thinking mode | <https://api-docs.deepseek.com/guides/reasoning_model> |
| Token counting | <https://api-docs.deepseek.com/quick_start/token_usage> |

**`deepseek-flash`**, the cheaper of the two published models. Requests use
`response_format: { type: "json_object" }`, `max_tokens: 900`, `temperature: 0.2`, no
streaming, `thinking: { type: "disabled" }`, and a 25-second timeout.

Two corrections came out of that check:

- An earlier note here called `deepseek-flash` "the non-reasoning model". **That was wrong.**
  The reasoning guide shows `deepseek-flash` used with `thinking: {"type": "enabled"}`, so it
  supports thinking and simply does not use it unless asked. Disabling it is therefore a real
  cost control — thinking tokens bill as output — not a formality.
- The JSON output guide requires the literal word "json" in the prompt *and* an example of the
  shape. The example was there; the lowercase word was not, and has been added. The same guide
  warns the API "may occasionally return empty content", which is now handled as a billed
  failure, as is a `finish_reason` of `length` (truncated, unparseable JSON).

Prices quoted from the pricing page, per 1M tokens: `deepseek-flash` input cache-miss $0.15
off-peak / $0.30 peak, cache-hit $0.003 / $0.006, output $0.60 / $1.20. Peak is 01:00–04:00 and
06:00–10:00 UTC, Monday to Friday.

### Spend controls

Paid requests are off by default and stay off until **all four** of these hold:

| Gate | Why |
|---|---|
| `AI_LIVE_REQUESTS=enabled` | An explicit switch, so no deployment starts spending by accident. |
| `DEEPSEEK_API_KEY` set | Obvious. |
| Supabase configured | The budget ledger and rate limits live there. |
| A row in `ai_budget` | Migrations `0003`/`0004` leave one at **$0.50**. |

On top of that:

- **Called only on "Help me choose".** Never on page load, never while typing, never after a
  variant change.
- **One attempt, no retries.** Retrying a paid endpoint automatically doubles the bill for a
  request the shopper made once. Retry is a button the shopper presses.
- **Request shape is capped**: at most 3 products, their specifications, and at most 4 review
  excerpts each; preference text is cut at 280 characters; the whole body is rejected above 8 KB.
- **Results are cached** in Supabase by model, catalog version, products, chosen variants and
  normalised preferences. An identical question is never paid for twice.
- **Concurrent duplicates are refused.** A cache only helps once an answer exists — two
  identical questions asked at the same moment would both miss it and both be billed. The
  in-flight check lives inside the same SQL function that reserves budget, so the check and the
  reservation cannot interleave. The second caller gets a retryable 409. A reservation stops
  blocking after two minutes, so a crashed request cannot wedge a cache key.
- **Per-visitor rate limits**: 6 per hour, 20 per day, keyed by a salted hash of IP and user
  agent. Neither the IP nor the user agent is stored.

### How the budget actually works, and what it does not guarantee

The ceiling is **$0.50**, held in `ai_budget.limit_micros`. Nothing in this schema resets,
replenishes or tops it up — there is no scheduled job and no code path that raises it. It moves
only when a human runs:

```sql
select public.ai_set_budget_limit(2000000);  -- $2.00
select public.ai_budget_status();            -- what is committed so far
```

Migration `0004` lowers the earlier `0003` default from $5.00 to $0.50, and only if the value is
still that untouched default — an operator who has set their own ceiling keeps it. It does not
touch `ai_usage`, so every existing spend record is preserved.

Cost is tracked in integer micro-dollars. Before a call the route reserves an estimate covering
**the bounded input it is about to send plus the full `max_tokens` output ceiling** — never an
expected output length — priced at DeepSeek's **peak, cache-miss** rates. The input estimate uses
1/3 token per character against the documented "1 English character ≈ 0.3 token", then a further
1.3× safety factor. An off-peak call therefore costs roughly half what was set aside.

The reservation is recorded in `ai_usage` as `reserved`, then replaced with the real cost from
the token usage the API reports. Committed spend is settled actuals plus outstanding
reservations, so concurrent requests cannot both slip under the ceiling.

**Failures keep their reservation.** The only outcome treated as free is a request that never
left the process (no API key). A timeout, a non-2xx, a dropped connection, an empty completion
or truncated output all keep the full reservation, because a request that may have reached
DeepSeek may have been billed, and assuming otherwise is how a budget stops being one.

Honest limitations — this bounds spend, it is not a hard financial guarantee:

- Costs are computed from **published prices and reported token counts**. If either is wrong or
  changes, the ledger is wrong.
- A call can be billed by DeepSeek while the settle write fails (a crash between the two). The
  reservation then stands, which errs towards under-spending, but the recorded figure is an
  estimate rather than the invoice.
- Uncertain failures are recorded as **billed at the reserved estimate**, which deliberately
  over-counts rather than under-counts.
- The in-flight duplicate check covers concurrent requests through this route. It does not
  coordinate with anything else using the same key.
- It only knows about requests made through this route. Spend from anywhere else on the same
  key is invisible to it.
- **A request count is not a dollar cap.** The cap is on estimated dollars; request limits are a
  separate, coarser guard.

Check the ledger directly with `select public.ai_budget_status();`, and change the ceiling by
updating `ai_budget.limit_micros`.

### Review confidence is not the model's opinion

Two assessments appear per product, and they are produced differently on purpose.

**Review confidence** is computed on the server by fixed rules in
`src/server/ai/confidence.ts`. It measures *how far the available review evidence supports any
conclusion* — not quality, and not whether a shopper will be happy. The rules:

| Review texts analysed | Level |
|---|---|
| 0–1 | Insufficient evidence |
| 2–3 | Low |
| 4–7 | Medium |
| 8+ | High |

then one downgrade (never below Low) when the analysed ratings span 3 stars or more, because
sharply split opinion supports less.

This demo catalog holds at most **four** review texts per product, so **High is unreachable
here**. That is deliberate. The aggregate "412 written reviews" figures in the demo data are
just numbers — those individual reviews do not exist, and nothing has read them. The panel says
so, and the count of texts actually analysed is shown next to every assessment.

The model is told explicitly not to produce a confidence rating, and its output is not consulted
for one.

**Match for your needs** is the model's, and is where suitability, tradeoffs and unknowns live.
With preferences it offers a suggested choice, including "No clear match". Without preferences
it describes differences and picks no winner.

### Keeping the model honest

- Review text and preference text go into a JSON payload the system prompt identifies as **data,
  not instructions**.
- Every review-based claim must cite review ids, and output is validated against the ids
  actually sent — a citation we did not supply is dropped.

  **What that check does not establish.** A valid id proves the referenced review exists and was
  in evidence. It does **not** prove the sentence beside it is supported by that review's
  content: nothing here reads the review and tests the claim against it, and a model can cite a
  real review and still describe it wrongly. The check is a floor against invented sources. The
  cited reviews are rendered in full next to the claim precisely because the reader, not the
  validator, is what closes that gap.
- Budget comparisons are computed in integer cents in `src/server/ai/guidance.ts` and handed to
  the model as booleans. It is told not to do arithmetic on prices.
- If no clothing size is chosen, the price is marked provisional everywhere it appears and no
  confirmed variant price is claimed.
- Output failing validation is reported as an error. Canned text is never presented as a live
  response.

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
| 3 | Optional comparison for up to three products | done |
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

Every image in `public/images/` is an SVG illustration generated by
`scripts/generate-product-images.py`. Nothing was downloaded or derived from a third-party
image, so the set carries no attribution or licence obligation. They are drawings, not
photographs — `public/images/README.md` records what was checked before settling on that, and
what would need to change to use photography.

## Exploration notes

`recon/` holds the Amazon shopper-experience reference material — redacted screenshots and
written observations — along with an explicit record of which flows were never observed. Open
product questions are routed there to the implementation step that needs them.
