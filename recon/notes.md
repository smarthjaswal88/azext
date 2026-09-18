# Amazon Shopper-Experience Recon

**Status: NOT EXPLORED — blocked by access restrictions.**

This file is a collection plan, not a findings report. No Amazon page was viewed during this
session. Every observation slot below is deliberately empty. Nothing here describes Amazon's
actual UI from memory or inference.

---

## 1. Pages and flows actually explored

**None.**

| Flow | URL attempted | Result |
|---|---|---|
| Search results (headphones) | `https://www.amazon.com/s?k=wireless+headphones` | HTTP 503, no body returned |
| Homepage | `https://www.amazon.com/` | HTTP 200 to `curl`, but not retrieved or read as a page |
| `robots.txt` | `https://www.amazon.com/robots.txt` | 200, retrieved and read |

No product page, search result, review page, cart, or checkout step was loaded or read.

---

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

Chrome is installed on this machine, so it is technically possible to drive it via AppleScript
and capture the screen. **That was not done, and needs your explicit go-ahead**, because it
would use your real signed-in Chrome profile: screenshots could capture your Amazon account
name, saved addresses, order history, and stored payment methods. That conflicts directly with
the instruction not to capture personal or payment information. See "Decisions needed".

### 2.4 Flows not explored

All six. Nothing in flows 1-6 was observed.

---

## 3. What to collect manually

Save images to `recon/screenshots/` using the filenames below so the observation slots in
section 4 line up. PNG, full page where possible, desktop width (~1440px) unless noted.

**Before capturing anything:** sign out of Amazon, or use a private window. This keeps your
account name, addresses, order history and payment methods out of every screenshot. Where a
flow requires being signed in (cart persistence, checkout), see the redaction note in 3.5.

### 3.1 Homepage navigation and search

| File | What to capture |
|---|---|
| `01-home.png` | Homepage as first loaded — header, nav, main content |
| `02-home-nav-open.png` | Departments / "All" menu expanded |
| `03-search-suggest-headphones.png` | Search box after typing `headphones`, suggestions visible |
| `04-search-suggest-clothing.png` | Search box after typing a clothing term, suggestions visible |

### 3.2 Search results, filtering, sorting

| File | What to capture |
|---|---|
| `10-results-headphones.png` | Unfiltered results, left filter rail visible |
| `11-results-headphones-filters.png` | Filter rail scrolled/expanded — capture every facet name |
| `12-results-headphones-sort.png` | Sort dropdown open, all options readable |
| `13-results-headphones-filtered.png` | After applying 2-3 filters — note how active filters are shown |
| `14-results-clothing.png` | Same, for a clothing category |
| `15-results-clothing-filters.png` | Clothing filter rail — **this is the key comparison shot** |
| `16-results-clothing-sort.png` | Sort dropdown for clothing |

For each: note the URL, and whether filters change the URL or only the page.

### 3.3 Product detail pages

| File | What to capture |
|---|---|
| `20-pdp-headphones-top.png` | Top of PDP — gallery, title, price, buy box together |
| `21-pdp-headphones-gallery.png` | Image gallery expanded / zoom state |
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
| `44-cart-empty.png` | Empty cart state |

### 3.6 Checkout — stop early

| File | What to capture |
|---|---|
| `50-checkout-entry.png` | What appears on starting checkout (sign-in wall, or first step) |
| `51-checkout-steps.png` | Step indicator / overall structure, if visible |

**Stop at the first screen requesting payment details.** Do not capture address, contact, or
payment fields containing real data. Do not place an order. If a step shows your saved address
or cards, either skip the screenshot or black out those regions before saving.

Redaction: if any image contains your name, email, address, phone, order history, or partial
card numbers, black it out before saving into `recon/`. These files get committed to git.

### 3.7 Observations to write down alongside the screenshots

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

*Empty pending collection. To be filled in strictly from the screenshots above.*

### 4.1 Homepage and search
> _not yet observed_

### 4.2 Results, filtering, sorting
> _not yet observed_

### 4.3 Product details, pricing, availability, variants
> _not yet observed_

### 4.4 Ratings and reviews
> _not yet observed_

### 4.5 Cart
> _not yet observed_

### 4.6 Checkout
> _not yet observed_

### 4.7 Differences between clothing and headphones
> _not yet observed_

Open questions for this section are listed in 3.7 (items 2-6). They are questions, not
findings — I have deliberately not pre-filled expected answers here, so that the screenshots
determine the answer rather than confirm a guess.

---

## 5. Proposals — our rebuild

**This section is our own design thinking. Nothing in it is an observation of Amazon, and
nothing here should be read as describing an Amazon feature.** It is written before recon and
must be re-checked against section 4 once that is filled in.

### 5.1 Two categories with different variant shapes

Headphones and clothing were chosen as the initial catalog precisely because their variant
axes differ. The product model needs to carry category-specific option axes and per-variant
availability from the start, rather than assuming a single flat "options" list. Section 3.7
questions 3-6 determine the exact shape.

### 5.2 Where the optional comparison feature fits

Our comparison feature — selecting up to three products and explaining them using
specifications, ratings, review insights, and the shopper's stated preferences — **is ours,
not a rebuild of anything on Amazon**. Candidate entry points, to be assessed against recon:

| Entry point | Why it might work |
|---|---|
| Search results | Shortlisting happens here; a per-card "compare" toggle is unobtrusive |
| Product detail page | The moment of hesitation between two candidates |
| Persistent tray | Keeps the ≤3 selection visible while browsing continues |

The journey brief is explicit that comparison is **optional** and that browse → product →
checkout must work without ever touching it. Whatever entry point we pick must be skippable
and must not sit between the shopper and the buy button.

### 5.3 Two assessments, kept separate

Review confidence (how much the review evidence supports a conclusion) and personal
suitability (how well the product fits this shopper's stated preferences) are distinct and
must remain visually and structurally separate. A product can have overwhelming review
evidence and still be a poor fit — collapsing these into one score destroys that. This
constrains the comparison UI and the eventual DeepSeek response schema.

### 5.4 Deferred

Not in scope for the next step: DeepSeek calls, authentication, real catalog data, search
implementation, payment. Comparison logic itself comes after the plain journey works.

---

## 6. Provenance

| Item | Value |
|---|---|
| Session | `4b66e06d` |
| Date | 2026-09-18 |
| Model | Opus 5 (1M context), `claude-opus-5[1m]` |
| Pages viewed | none |
| Screenshots produced by agent | none |

Any screenshot appearing under `recon/screenshots/` was collected manually by Smarth Jaswal,
not by this agent.
