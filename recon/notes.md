# Amazon Shopper-Experience Recon

**Status: AWAITING MANUAL EXPLORATION ASSETS.** (Review attempted 2026-09-18 — no assets
found; see 1.1.)

Agent-side exploration is blocked (section 2). Smarth Jaswal is exploring Amazon manually and
will supply screenshots and observations under `recon/`.

This file is a collection plan, not a findings report. No Amazon page was viewed by the agent.
Every observation slot below is deliberately empty. Nothing here describes Amazon's actual UI
from memory or inference. Section 4 will be filled in only from the supplied evidence.

---

## 1. Pages and flows actually explored

**None.**

### 1.1 Asset review log

| Date | Action | Result |
|---|---|---|
| 2026-09-18 | Reviewed `recon/` for supplied exploration assets | **Nothing found.** `recon/` was byte-identical to commit `37c0ba8`: only `notes.md` and `screenshots/README.md`, both agent-authored. No screenshots, no observation files, anywhere in the repository. |

Section 4 was therefore left empty. No observation was written, because there was no evidence
to write one from.

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

Chrome is installed, so driving it via AppleScript was technically possible. **Declined by
Smarth Jaswal on 2026-09-18: the signed-in Chrome profile is not to be automated.** That is
the right call — it would have run against a real account, putting account name, saved
addresses, order history and stored payment methods into screenshots destined for git.

This is settled, not an open question. Exploration is manual and agent-side automation of the
browser is off the table for this project.

### 2.4 Flows not explored

All six. Nothing in flows 1-6 was observed.

---

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

Open questions for this section are listed in 3.8 (items 2-6). They are questions, not
findings — I have deliberately not pre-filled expected answers here, so that the screenshots
determine the answer rather than confirm a guess.

---

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
| Headphone variants | colour, plus a spec table | 3.8 q4 |
| Clothing variants | size × colour, per-variant availability | 3.8 q3-q6 |
| Reviews scoped to | product, not variant | 3.8 q5 |

Every row is a guess until section 4 is filled in. The clothing variant structure is the one
most likely to be wrong and the most expensive to get wrong, since step 3's comparison reads
whatever step 2's model produces.

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
| Screenshots produced by agent | none |
| Browser automation | declined by Smarth Jaswal, 2026-09-18 |
| Exploration method | manual, by Smarth Jaswal |

Any screenshot appearing under `recon/screenshots/` was collected manually by Smarth Jaswal,
not by this agent.
