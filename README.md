# Shop

A shopping storefront with an optional AI product comparison feature.

Shoppers browse, pick a product and check out directly. Alternatively they can compare up to
three products using specifications, ratings, review insights and their own stated preferences.

**This repository currently contains the project scaffold only.** There is no catalog, no
search, no cart, no checkout and no AI integration yet — just a placeholder homepage that
proves the toolchain works.

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

## Architecture

Next.js App Router with TypeScript and Tailwind CSS v4.

```
src/app/
  layout.tsx    root layout
  globals.css   Tailwind entry point and theme tokens
  page.tsx      placeholder homepage
```

Backend work will use **Next.js route handlers** inside `src/app/`. There is no separate backend
service and none is planned. No placeholder API routes exist yet — they will be added when
something actually calls them.

Shared components, product types and server utilities will get their own directories under
`src/` at the point where there is real code to put in them, rather than being created empty now.

### Planned sequence

| Step | Scope | Status |
|---|---|---|
| 1 | Scaffold: App Router, TypeScript, Tailwind, ESLint, placeholder homepage | done |
| 2 | Catalog, search, product details, cart, simulated checkout | not started |
| 3 | Optional comparison for up to three products | not started |
| 4 | Review-confidence and personal-suitability explanations via DeepSeek | not started |

Comparison is a core feature of the submission, but it stays optional in the shopper journey:
browse → product → checkout must always work without it.

Review confidence (how strongly the review evidence supports a conclusion) and personal
suitability (how well a product fits this shopper's stated preferences) are two separate
assessments and are kept structurally separate throughout.

## Exploration notes

`recon/` holds the Amazon shopper-experience reference material — redacted screenshots and
written observations — along with an explicit record of which flows were never observed. Open
product questions are routed there to the implementation step that needs them.
