# Amazon Shopper-Experience Recon

**Status: PARTIALLY EXPLORED.** 12 screenshots supplied and reviewed. Flows 1-5 observed in
part; flow 6 (checkout) not observed at all. Categories captured are video games, supplements
and clothing — **no headphones PDP and no clothing PDP**. See section 2.4 for the full gap list.

Agent-side exploration is blocked (section 2). Smarth Jaswal is exploring Amazon manually and
will supply screenshots and observations under `recon/`.

This file is a collection plan, not a findings report. No Amazon page was viewed by the agent.
Every observation slot below is deliberately empty. Nothing here describes Amazon's actual UI
from memory or inference. Section 4 will be filled in only from the supplied evidence.

---

## 1. Pages and flows actually explored

Exploration was performed manually by Smarth Jaswal on 2026-09-18, 19:54-20:01 local, in a
signed-in browser session. The agent viewed the resulting screenshots only; it did not visit
Amazon (section 2).

### 1.1 Screenshot inventory

All 12 images are in `recon/screenshots/`. URLs were not captured — the browser address bar is
outside every frame — so no source URL can be cited for any of them. They are identified by
on-page breadcrumb and content instead.

| File | Page | Category |
|---|---|---|
| `01-home.png` | Homepage | — |
| `10-results-supplements.png` | Search results, query `whey protein powder` | supplements |
| `11-results-clothing-shirts.png` | Search results, query `Shirts` | clothing |
| `12-nav-departments-drawer.png` | Departments drawer over the `Shirts` results | clothing |
| `20-pdp-console-variants.png` | PDP upper — Video Games › PlayStation 5 › Consoles | video games |
| `21-pdp-console-lower.png` | PDP mid — about / Ask Alexa / cross-sell | video games |
| `22-pdp-console-specs.png` | PDP lower — specification tables | video games |
| `23-pdp-supplement-buybox.png` | PDP — Health & Household › … › Protein | supplements |
| `30-reviews-breakdown-filters.png` | Customer reviews — histogram and controls | supplements |
| `31-reviews-list.png` | Customer reviews — individual reviews | supplements |
| `40-cart-added-confirm.png` | Added-to-cart interstitial | supplements |
| `41-cart-qty-stepper.png` | Cart flyout at quantity 3 | supplements |

### 1.2 Redaction applied

The session was signed in, so every full-page screenshot carried the account holder's name, the
`Kunal's Amazon.com` nav entry, and a delivery postcode. Before copying into `recon/`, a black
band was drawn over the top header of all full-page shots, plus targeted boxes over the in-page
delivery location on both PDPs and over third-party reviewer names and avatars on the two review
shots. Redaction used `ffmpeg drawbox`; the originals in `~/Documents/Screenshots/` are
untouched.

The header band removes the search input and global nav from view. That is a deliberate
trade-off — it is why section 4.1 says little about the header.

### 1.3 Screenshots reviewed and excluded

Six older images in the same folder (2026-09-14 to 2026-09-16) are unrelated internal work
dashboards — lead-enrichment tables containing real people's names, job titles and business
email addresses. They are not Amazon recon and were **not** copied into the repository.

## 2. Access limitations

Three independent blockers, verified this session rather than assumed:

### 2.1 Amazon's robots.txt disallows this agent site-wide

`https://www.amazon.com/robots.txt` contains, verbatim:

```
User-agent: ClaudeBot
Disallow: /
```

This is a blanket disallow covering the entire site. It is not a rate limit or a soft
preference. Automated retrieval of Amazon pages by this agent is out of scope on that basis
alone, so no scraping was attempted beyond the two status checks recorded above.

The same file disallows `/gp/cart` for *all* user agents, so cart and checkout flows are
excluded from automated access independently of the ClaudeBot rule.

### 2.2 Fetching is blocked in practice

The search URL returned **HTTP 503 Service Unavailable** with no body — Amazon's standard
response to non-browser clients. Text-level access is unavailable even setting policy aside.

### 2.3 No browser automation exists in this environment

Checked and confirmed absent:

| Capability | Status |
|---|---|
| Playwright (tool, npm module, or browser cache) | not installed |
| Selenium / chromedriver / geckodriver | not installed |
| Browser-control MCP server | none connected |
| Screenshot-capable browser tool | none available |
| Google Chrome.app / Safari.app | present, but no driver to control them |

Chrome is installed, so driving it via AppleScript was technically possible. **Declined by
Smarth Jaswal on 2026-09-18: the signed-in Chrome profile is not to be automated.** That is
the right call — it would have run against a real account, putting account name, saved
addresses, order history and stored payment methods into screenshots destined for git.

This is settled, not an open question. Exploration is manual and agent-side automation of the
browser is off the table for this project.

### 2.4 Flows not observed, and gaps in what was

Recorded from what the 12 screenshots do and do not show.

**Not observed at all**

| Gap | Consequence |
|---|---|
| Checkout, any step (flow 6) | No evidence of step structure, or where a sign-in wall falls |
| Removing an item from the cart | Add and quantity-change observed; removal not |
| Empty cart state | — |
| Search suggestions while typing | — |
| Sort dropdown contents | Only the closed `Sort by: Featured` control is visible |
| Any size chart | — |
| Any AI or aggregated review summary | Nothing of the kind appears in either review shot |

**Category gaps**

No headphones page of any kind was captured, and clothing was captured only at search-results
level. Both PDPs are from other categories (a games console and a supplement). So PDP structure
is evidenced, but **not** for either of our two launch categories.

**Questions from 3.8 still unanswered**

| # | Question | Why unanswered |
|---|---|---|
| 1 | Do filters change the URL? | No address bar in any frame |
| 3 | Does selecting a clothing size change product identity? | No clothing PDP |
| 4 | Does changing a variant change price/images/availability? | Partially — see 4.3; images not evidenced |
| 6 | How is an out-of-stock variant presented? | Partially — see 4.3; no true per-variant stock-out |
| 8 | Does side-by-side comparison exist? | Partially — see 4.7; not opened |

## 3. What to collect manually

Save images to `recon/screenshots/` using the filenames below so the observation slots in
section 4 line up. PNG, full page where possible, desktop width (~1440px) unless noted.

**Scope.** This list covers only our intended journey: browse → search → product → cart →
checkout, plus the evidence our comparison feature will draw on (specs, ratings, reviews).
Rows marked *(optional)* are useful but skippable — capture them only if they cost you nothing.
Everything unmarked is worth having. Nothing here asks you to explore recommendations, deals,
subscriptions, seller pages, or anything else outside that journey.

**Before capturing anything:** sign out of Amazon, or use a private window. This keeps your
account name, addresses, order history and payment methods out of every screenshot. Where a
flow requires being signed in (cart persistence, checkout), see the redaction note in 3.5.

### 3.1 Homepage navigation and search

| File | What to capture |
|---|---|
| `01-home.png` | Homepage as first loaded — header, nav, main content |
| `02-home-nav-open.png` | Departments / "All" menu expanded *(optional)* |
| `03-search-suggest-headphones.png` | Search box after typing `headphones`, suggestions visible |
| `04-search-suggest-clothing.png` | Same for a clothing term — only if suggestions differ in kind *(optional)* |

### 3.2 Search results, filtering, sorting

| File | What to capture |
|---|---|
| `10-results-headphones.png` | Unfiltered results, left filter rail visible |
| `11-results-headphones-filters.png` | Filter rail scrolled/expanded — capture every facet name |
| `12-results-headphones-sort.png` | Sort dropdown open, all options readable |
| `13-results-headphones-filtered.png` | After applying 2-3 filters — note how active filters are shown |
| `14-results-clothing.png` | Same, for a clothing category |
| `15-results-clothing-filters.png` | Clothing filter rail — **this is the key comparison shot** |
| `16-results-clothing-sort.png` | Sort dropdown for clothing — skip if identical to `12` *(optional)* |

For each: note the URL, and whether filters change the URL or only the page.

### 3.3 Product detail pages

| File | What to capture |
|---|---|
| `20-pdp-headphones-top.png` | Top of PDP — gallery, title, price, buy box together |
| `21-pdp-headphones-gallery.png` | Image gallery expanded / zoom state *(optional)* |
| `22-pdp-headphones-variants.png` | Variant selectors (colour, model) |
| `23-pdp-headphones-buybox.png` | Close-up: price, availability, delivery estimate, quantity, buttons |
| `24-pdp-headphones-specs.png` | Technical specification table |
| `25-pdp-clothing-top.png` | Top of a clothing PDP |
| `26-pdp-clothing-variants.png` | Size **and** colour selectors together |
| `27-pdp-clothing-sizechart.png` | Size guide / chart, opened |
| `28-pdp-clothing-buybox.png` | Buy box, including any return/fit messaging |
| `29-pdp-oos.png` | Any variant that is out of stock or unavailable |

`29-pdp-oos.png` matters more than it looks — how unavailability is represented per-variant
drives our data model.

### 3.4 Ratings and reviews

| File | What to capture |
|---|---|
| `30-reviews-headphones-breakdown.png` | Star distribution / histogram |
| `31-reviews-headphones-list.png` | Several individual reviews |
| `32-reviews-headphones-controls.png` | Review sort/filter controls |
| `33-reviews-clothing-breakdown.png` | Star distribution for clothing |
| `34-reviews-clothing-fit.png` | Any fit- or size-specific review feedback |
| `35-reviews-summary.png` | Any summarised or aggregated review presentation |

For `35`: capture what is actually shown and note whether it is labelled as AI-generated.
This is the closest existing neighbour to our feature and we should know exactly what it does
before we design around it.

### 3.5 Cart

| File | What to capture |
|---|---|
| `40-cart-add-confirm.png` | Confirmation shown immediately after adding |
| `41-cart-page.png` | Cart page with at least 2 items |
| `42-cart-qty.png` | Quantity control, mid-change |
| `43-cart-after-remove.png` | After removing an item — note undo affordance |
| `44-cart-empty.png` | Empty cart state *(optional, but it is a state we must build)* |

### 3.6 Checkout — stop early

| File | What to capture |
|---|---|
| `50-checkout-entry.png` | What appears on starting checkout (sign-in wall, or first step) |
| `51-checkout-steps.png` | Step indicator / overall structure, if visible *(optional)* |

**Stop at the first screen requesting payment details.** Do not capture address, contact, or
payment fields containing real data. Do not place an order. If a step shows your saved address
or cards, either skip the screenshot or black out those regions before saving.

Redaction: if any image contains your name, email, address, phone, order history, or partial
card numbers, black it out before saving into `recon/`. These files get committed to git.

### 3.7 Recording flows you could not access

Some of this may be unreachable without signing in, or may hit a sign-in wall partway. That is
a finding, not a gap to paper over. For anything you cannot reach, note it here rather than
leaving it blank or approximating:

| Flow / screenshot | How far you got | What stopped you |
|---|---|---|
| _e.g. `50-checkout-entry.png`_ | _reached cart, pressed checkout_ | _sign-in wall_ |
|  |  |  |

Section 2.4 will be updated from this table, so unreached flows stay visible in the record
instead of quietly disappearing. If a screenshot in the lists above never arrives, I will treat
it as not collected and will not infer what it would have shown.

### 3.8 Observations to write down alongside the screenshots

Screenshots alone will not answer these. A sentence each is enough:

1. Do search filters change the URL, or only update in place?
2. Which facets appear for clothing that do **not** appear for headphones, and vice versa?
3. On a clothing PDP, does selecting a size change the URL/product identity, or just the page?
4. Does changing a variant change price, images, availability, or reviews?
5. Are reviews shared across all variants of a product, or per-variant?
6. How is an out-of-stock variant presented — hidden, greyed, or selectable-then-blocked?
7. What is the minimum needed before checkout demands a sign-in?
8. Is there any side-by-side product comparison anywhere in the flow? If yes, where does it
   start from, how many products, and what attributes does it line up? If you find none, say
   so — that is equally useful.
9. How far can checkout be reached before payment entry is unavoidable?

---

## 4. Observations — Amazon

Every statement below is visible in a named screenshot. Where something is suggested but not
demonstrated, it is marked **not demonstrated** rather than asserted. No URL is cited because
none was captured.

### 4.1 Homepage and search

`01-home.png`. A full-bleed promotional carousel with left/right arrows, then a row of equal
card modules — "Keep shopping for", "Get your game on", "Top categories in Kitchen appliances",
"Easy updates for elevated spaces". Each module is a heading over a grid of image tiles with
short captions; the "Keep shopping for" tiles carry a "7 viewed" / "2 viewed" subcaption. A
full-width locale notice sits between carousel and cards.

The global header and search input are redacted out of this shot (1.2), so nothing is recorded
about them.

### 4.2 Results, filtering, sorting

`10-results-supplements.png`, `11-results-clothing-shirts.png`.

Shared structure: a result-count line ("1-48 of over 1,000 results for …"), a `Sort by: Featured`
control at top right, a left filter rail, a horizontal chip row headed "Narrow your search" whose
chips carry small product thumbnails and overflow behind a right arrow, then the result grid.

Result cards carry: badges ("Previously viewed", "Overall Pick", "Best Seller"), title, star
rating with a bracketed review count, and price. Beyond that they are **not uniform** — some
cards in `10` show price, delivery date and "Ships to India", others show a "Small Business"
badge and no price at all in the same row. Prices appear with a unit price beside them
(`$38.29 ($1.35/ounce)`, `$15.10 ($7.55/count)`) and discounts as a red percentage with a struck
"Typical:" price.

The sort control was never opened, so its options are unknown.

### 4.3 Product details, pricing, availability, variants

`20-pdp-console-variants.png`, `21`, `22`, `23-pdp-supplement-buybox.png`.

Layout on both PDPs: breadcrumb; vertical thumbnail rail (including video thumbnails — `23`
labels "8 VIDEOS") beside a large image with "Click to see full view"; centre column with brand
link, title, rating, badges and variant selectors; right-hand buy box.

**Both PDPs use two variant axes, not one.**

| Screenshot | Axis 1 | Axis 2 |
|---|---|---|
| `20` (console) | Style — PS5 Digital / Disc / Pro / Bundle | Configuration — 10 tiles |
| `23` (supplement) | Flavor Name — 8 options | Size — 2 options + 1 unavailable |

Two details worth carrying into our model:

1. **The axis label restates the current selection** — "Style: **PS5 Digital**", "Flavor Name:
   **Chocolate**". The selected tile has a solid border; unselected tiles have dashed borders.
2. **Variant tiles can carry their own price.** In `23` the Size tiles show `2.09 Pound —
   $39.78 ($1.19/ounce)` and `4.19 Pound — $55.03 ($0.82/ounce)` with `$59.09` struck through.
   Price is therefore per-variant, not per-product. Whether images or availability also change
   per variant is **not demonstrated** — no before/after pair was captured.

**Unavailability appears in two distinct forms**, and neither is a plain per-variant stock-out:

- `20`: "This item cannot be shipped to your selected delivery location." printed both inline in
  the centre column and inside the buy box, where it **replaces the purchase controls** with a
  "See Similar Items" button. The buy box is state-dependent, not a fixed set of buttons.
- `23`: a third Size tile reading "See 1 options with no featured offers" — a variant that
  exists in the selector but has no purchasable offer behind it.

Buy box contents in `23`: price with unit price, a delivery window ("Delivery October 5 - 27"),
a Quantity dropdown, "Add to cart", "Buy Now", then Shipper/Seller, Returns
("Non-returnable due to Food safety reasons"), Gift options, and secondary "Add to Auto Buy" /
"Add to List" actions.

`22-pdp-console-specs.png` shows specifications as two side-by-side collapsible panels of
key/value rows — "Features & Specs" (Platform, Input Device, Connectivity Technology, Memory
Storage Capacity, Wireless Communication Technology, Resolution, Software Update Supported to
Date) and "Item details" (Brand Name, Model Name, Model Number, Manufacturer, UPC, Item Weight,
Manufacturer Part Number, Best Sellers Rank, ASIN, Customer Reviews) — plus a separate
"Additional details" panel holding Color, and a prose Product Description.

### 4.4 Ratings and reviews

`30-reviews-breakdown-filters.png`, `31-reviews-list.png`. Reviews have their own page, reached
via a breadcrumb from the product title.

Header: "4.4 out of 5", "4,369 global ratings", and a five-row histogram (5★ 73%, 4★ 11%,
3★ 5%, 2★ 3%, 1★ 8%) whose row labels are rendered as links. A "How customer reviews and
ratings work" disclosure sits beneath.

Controls: a "Search customer reviews" box with its own Search button; SORT BY (`Top reviews`);
FILTER BY four dropdowns — `All reviewers`, `5 star only`, **`All variants`**, `Text, image,
video`. Applied filters echo back as "FILTERED BY / 5 star / Clear filter" with a live count:
"642 matching customer reviews".

**Reviews carry variant attribution.** Each review in `31` shows a "Flavor Name: … | Size: …"
line and a "Verified Purchase" badge. Notably the page is scoped to Size 4.19 Pound (the header
in `30` shows the selected variant with a "Change" link) yet reviews for the 7.47 Pound size
appear in the list. So reviews are **pooled across variants by default while retaining
per-variant attribution**, with an "All variants" control to narrow them. This is a direct,
supported answer to question 5 in 3.8.

Each review is: avatar, reviewer name, star rating, bold title, "Reviewed in the United States
on <date>", the variant line, Verified Purchase badge, body text, an optional "One person found
this helpful", then Helpful and Report buttons. Reviewer names and avatars are redacted in our
copies.

### 4.5 Cart

`40-cart-added-confirm.png`, `41-cart-qty-stepper.png`.

Adding an item routes to a confirmation page — green tick, "Added to cart", and **the chosen
variant echoed back** ("Flavor Name: Chocolate / Size: 4.19 Pound (Pack of 1)"). A panel on the
right gives "Cart Subtotal: $55.03", a primary "Proceed to checkout (1 item)" and a secondary
"Go to Cart". Below sits a "Customers who bought items in your cart also bought" carousel.

A cart flyout is pinned to the right edge showing subtotal, product thumbnail, price and a
quantity stepper. Comparing the two shots:

| | `40` | `41` |
|---|---|---|
| Quantity | 1 | 3 |
| Subtotal | $55.03 | $165.09 |
| Cart badge | 1 | 3 |
| Decrement control | **trash icon** | **minus sign** |

3 × $55.03 = $165.09, so quantity changes recompute the subtotal and the header badge. The
decrement control changing from a bin to a minus at quantity 1 is a small, deliberate touch —
removal and decrement are the same control in different states. Removal itself was not
exercised, so the resulting state is **not demonstrated**.

### 4.6 Checkout

Not observed. No screenshot shows any checkout step.

### 4.7 Differences between clothing and other categories

Only the search-results layer can be compared, since no clothing PDP was captured. The filter
rails differ substantially:

| `10` — supplements | `11` — clothing |
|---|---|
| Popular Shopping Ideas (5 Lbs, Isolate, Grass-fed, Bulk) | Popular Shopping Ideas (Graphic, Kids, Button-up, Polo) |
| Customer Reviews (4★ & Up) | **Gender** — Men, Women, Boys, Girls, Babies, Unisex |
| Deals & Discounts | **Color** — a grid of colour swatches, no text labels |
| **Price** — histogram slider plus bracket links | **Sleeve Type** — Cuff, Cap, Raglan … |

Clothing introduces facets with no supplement equivalent (Gender, Sleeve Type) and renders
Color as visual swatches rather than a labelled list. Supplements get a price histogram that
clothing does not show. `11` also carries a brand banner module ("amazon essentials — Style for
all") above the results that `10` does not.

`12-nav-departments-drawer.png` shows the departments menu as a left slide-over with the page
dimmed behind it, grouped into "Digital Content & Devices", "Shop by Department" and "Programs
& Features", each row with a chevron.

### 4.8 Side-by-side comparison

`21-pdp-console-lower.png` shows an "Ask Alexa" chip row on the PDP containing chips such as
"What games are compatible?", "Does it come with a controller?", "Is it easy to set up?", "Why
you might like this", **"Compare with similar"**, and "Ask something else".

That a chip with that label exists is all the evidence there is. It was not clicked, so what it
opens — a table, a chat answer, something else — how many products it covers, and what
attributes it lines up are all **not demonstrated**. Question 8 in 3.8 remains open.

This is an Amazon element. It is not related to, and must not be described as, our comparison
feature.

## 5. Proposals — our rebuild

**This section is our own design thinking. Nothing in it is an observation of Amazon, and
nothing here should be read as describing an Amazon feature.** It was written before recon.

**Everything in 5.2 is provisional.** Product counts and variant structures are placeholders
pending the evidence in section 4 — they are starting numbers to react to, not decisions. If
the screenshots contradict them, the screenshots win.

### 5.1 Implementation sequence (agreed)

| Step | Scope |
|---|---|
| 1 | Minimal boilerplate |
| 2 | Catalog, search, product details, cart, simulated checkout |
| 3 | Optional comparison for up to three products |
| 4 | Review confidence and personalised suitability explanations via DeepSeek |

Recon gates step 1. Steps 2-4 depend on what section 4 turns up — particularly the variant
model, which step 2 has to get right before step 3 can compare anything meaningfully.

### 5.2 Catalog shape — provisional

Headphones and clothing were chosen as the initial catalog because their variant axes differ.
The working assumption is that the product model must carry category-specific option axes and
per-variant availability, rather than a single flat "options" list.

| Placeholder | Value | Confirm via |
|---|---|---|
| Headphone products | ~8 | your judgement once results pages are reviewed |
| Clothing products | ~8 | as above |
| Headphone variants | colour, plus a spec table | 3.8 q4 — still open |
| Clothing variants | size × colour, per-variant availability | 3.8 q3-q6 — still open, no clothing PDP |
| Per-variant price | variant carries its own price | **supported** by 4.3 (`23`) |
| Reviews scoped to | product, with per-variant attribution and filtering | **supported** by 4.4 |

Every row is a guess until section 4 is filled in. The clothing variant structure is the one
most likely to be wrong and the most expensive to get wrong, since step 3's comparison reads
whatever step 2's model produces.

### 5.2b Open questions, routed to the step that needs them

None of these block step 1 (a generic scaffold). Each is recorded against the step that cannot
proceed without an answer.

| Open question | Needed by | How to close it |
|---|---|---|
| Clothing size × colour selector behaviour | Step 2 — product model | Capture a clothing PDP, or decide it ourselves |
| Whether a variant change swaps images/availability | Step 2 — product model | 4.3 shows price varies; images not demonstrated |
| True per-variant stock-out presentation | Step 2 — PDP | 4.3 shows two adjacent cases, neither exact |
| Checkout step structure | Step 2 — simulated checkout | Not observed at all; we may simply design our own |
| Cart item removal result state | Step 2 — cart | Decrement observed, removal not |
| Sort options | Step 2 — search | Control seen closed only |
| What "Compare with similar" actually does | Step 3 — comparison | 4.8; not demonstrated |

Since checkout is simulated in our build and comparison is our own feature, the last two are
informational rather than blocking. The clothing variant question is the one that genuinely
shapes step 2, and is now the most likely place to guess wrong — no clothing PDP was captured.

Reviews are the one area where recon gave a firm answer: 4.4 establishes that reviews pool
across variants while retaining per-variant attribution, and that variant-level filtering is
expected. Our review model should carry a variant reference per review from the start.

### 5.3 Comparison: core to the submission, optional in the journey

Both things are true at once, and the distinction matters:

- **Core to the submission.** Comparison is a headline feature, not a nice-to-have. It gets
  first-class design attention, not a corner of a page.
- **Optional in the journey.** A shopper must be able to browse, pick a product, and check out
  without ever opening it. It cannot sit between the shopper and the buy button.

Our comparison feature — up to three products, explained using specifications, ratings, review
insights, and the shopper's stated preferences — **is ours, not a rebuild of anything on
Amazon**. Candidate entry points, to be assessed against recon:

| Entry point | Why it might work |
|---|---|
| Search results | Shortlisting happens here; a per-card "compare" toggle is unobtrusive |
| Product detail page | The moment of hesitation between two candidates |
| Persistent tray | Keeps the ≤3 selection visible while browsing continues |

3.8 q8 asks what side-by-side comparison, if any, exists on Amazon today. A finding of "none"
is as useful as a finding of "here is where it lives" — it tells us we are not competing with
an established pattern shoppers already expect.

### 5.4 Two assessments, kept separate

Review confidence (how much the review evidence supports a conclusion) and personal suitability
(how well the product fits this shopper's stated preferences) are distinct and must remain
visually and structurally separate. A product can have overwhelming review evidence and still
be a poor fit — collapsing these into one score destroys that distinction.

This is a step 4 concern, but it constrains step 3: the comparison UI needs room for two
separate assessments per product before DeepSeek ever fills them in.

### 5.5 Deferred

Not in scope for step 1: DeepSeek calls, authentication, real catalog data, search
implementation, payment, comparison logic.

---

## 6. Provenance

| Item | Value |
|---|---|
| Session | `4b66e06d` |
| Date | 2026-09-18 |
| Model | Opus 5 (1M context), `claude-opus-5[1m]` |
| Pages viewed by agent | none |
| Screenshots produced by agent | none — 12 supplied manually, reviewed and redacted by agent |
| Browser automation | declined by Smarth Jaswal, 2026-09-18 |
| Exploration method | manual, by Smarth Jaswal |

Any screenshot appearing under `recon/screenshots/` was collected manually by Smarth Jaswal,
not by this agent.
