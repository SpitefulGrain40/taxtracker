# TaxTracker — Claude Code Context

UK personal tax tracker PWA. React + Vite + Tailwind CSS v4, deployed to GitHub Pages, data stored in a private GitHub repo.

**Account model: ONE account per install.** Each person opens the app and sets up their own data repo + keys + PIN; sharing = share the URL, they set up their own. There is no profile switching and no cross-account access. The active profile is a single fixed namespace (`getActiveProfile()` always returns `'mike'`; the `data/mike/…` path is that namespace, kept as-is to avoid migration — cosmetic only, since each person has their own repo).

## Critical rules — read before any edit

- **Always work on `dev` branch.** Never commit directly to `main`.
- **No emojis in the UI.** Lucide React icons only — consistent 2px stroke weight throughout.
- **Plain English first.** Every tax term that could confuse a layman needs a `JargonTip` tooltip. Never add HMRC jargon to user-facing labels without a plain English alternative.
- **Design tokens live in `src/index.css` `@theme` block** — not `tailwind.config.ts`. Tailwind v4 does not read `tailwind.config.ts` for tokens.
- **No backend.** This is a static PWA. No server, no environment variables at runtime, no secrets in source code.
- **Secrets in localStorage only** — GitHub PAT and Claude API key are entered by the user and stored in `localStorage`. They must never appear in source code, git history, or the data repo.
- **Run `npm run test` after any change to `src/lib/` or `src/components/ui/`.** All tests (214 at last count) must pass before committing.

## Project identity

**Users:** one account per install (see Account model above). Primary user Mike is on Android / Windows.

**Core screens (5):**
1. Dashboard — live running tax position, action items
2. Income — all income sources, forecaster
3. Documents — upload payslips/P11D/P60/CSV, Claude AI extraction
4. Share Schemes — lot register, CGT calculator, "what if I sell?" tool
5. Tax Return — SA100/SA102/CGT summary, copy-to-HMRC, encrypted export

**What's built:** All five screens are functional (Plans 1–8 complete — see Build progress). Onboarding, Claude document extraction, live tax position with full-year projection, share lots + CGT with live pricing, and the tax-return builder with encrypted export are all in place.

**Current branch:** `dev` — all work goes here; `main` is production. Never commit to `main` directly (merge `dev`→`main` to release).

## Tech stack

- React 18 + Vite + TypeScript
- Tailwind CSS v4 — tokens in `src/index.css @theme`, NOT tailwind.config.ts
- Lucide React — icons only, never emojis
- React Router v6 — basename derived from `import.meta.env.BASE_URL` in `src/AppRouter.tsx` (matches the deploy base: `/taxtracker/` prod, `/taxtracker-dev/` staging, `/` local). Never hardcode the basename — a mismatch renders a blank screen.
- `@octokit/rest` — GitHub API data layer
- Vitest + React Testing Library
- `claude-opus-4-8` — document extraction (vision + structured output)

## Design system

```
Copper accent:   #C8804A  (interactive, highlights, jargon underlines)
Green:           #5BAD82  (positive, confirmed)
Yellow:          #C89A3A  (warnings, estimates)
Red:             #B05858  (deductions, alerts)
Surface:         #141416  (cards)
Background:      #0C0C0E
Text primary:    #F0EAE0  (warm cream)
Text secondary:  #857F77
```

**Typography:**
- `font-serif` (DM Serif Display) — large numbers and screen titles
- `font-mono` (IBM Plex Mono) — precise monetary values, HMRC box numbers
- `font-sans` (IBM Plex Sans) — all body copy, labels

## Key files

| File | What it does |
|---|---|
| `src/types/index.ts` | All TypeScript types — Payslip, ShareLot, LifeEvent, Profile, etc. |
| `src/lib/auth.ts` | PBKDF2 PIN hashing (Web Crypto API) |
| `src/lib/storage.ts` | localStorage helpers — PAT, Claude key, PIN hash/salt, FX rates |
| `src/lib/github.ts` | GitHubDataClient — read/write JSON files in private data repo |
| `src/lib/taxYears.ts` | UK tax year utilities — 6 April boundary, tax periods |
| `src/components/ui/JargonTip.tsx` | Tax term tooltip — dashed copper underline, hover/tap |
| `src/components/ui/StatCard.tsx` | Stat display — label, value (serif font), variant colour |
| `src/App.tsx` | Auth gate: dev-seed → setup → PIN → onboarding → router |
| `src/AppRouter.tsx` | Router shell; basename from `import.meta.env.BASE_URL` |
| `src/lib/priceProxy.ts` | `fetchLivePrice()` — calls the Cloudflare Worker proxy |
| `src/lib/projection.ts` | `projectTaxYear()` — full-year income/tax projection (Plan 8) |
| `src/lib/devSeed.ts` | Dev-only `?seed` bypass + dummy data (inert in prod) |
| `src/index.css` | Tailwind v4 @import + all design tokens in @theme |

## Data repo structure

Private repo: `SpitefulGrain40/taxtracker-data`

```
data/mike/2025-26.json     # income, deductions, tax paid
data/mike/share-lots.json  # permanent lot register (all employers)
data/mike/life-events.json # salary changes, RSU vests, benefit changes
data/mike/profile.json     # NI number, tax code, scheme configs, PIN hash
data/gemma/...             # same structure, completely separate
```

## Share scheme tax rules

| Scheme type | Income tax trigger | CGT cost basis |
|---|---|---|
| `espp-match` | At purchase (employer match via PAYE) | Market value at purchase |
| `espp-discounted` | On discount value at purchase | Market value at purchase |
| `rsu` | At vest (full market value via PAYE) | Market value at vest date |

**Mike's scheme:** SAP ESPP employer-match, **XETRA-listed, denominated in EUR** (broker portal is EquatePlus; holding and purchase are in EUR — Yahoo symbol `SAP.DE` returns the correct EUR price). GBP is a **reference conversion only**, shown at today's live EUR→GBP rate. RSU vests start 2026-27 tax year. NOTE: UK CGT legally requires GBP conversion at the *acquisition* and *disposal* dates (historical rates), not today's — the "value today" GBP figure is for display, not for the CGT filing figure.
**Gemma's scheme:** ESPP discounted-purchase. Leaving after next vest. Future employer scheme to be added (may be USD — keep FX machinery).

Lots are employer-agnostic — tagged by employer + scheme type. Old lots persist permanently when changing jobs.

### Real-data findings (2026-07-17 — validated against Mike's actual SAP documents)

- **SAP shares are EUR/XETRA (not GBP, not USD/NYSE).** The broker portal (EquatePlus) reports the holding and purchase in EUR; GBP is a reference conversion only. Yahoo `SAP.DE` returns the correct EUR price. The app shows EUR value today (native) + GBP value today (converted at today's live EUR→GBP rate, for reference). The `acquisitionPriceGBP`/`costBasisGBP` fields on older imported lots may have been populated assuming the raw EUR number was GBP — re-import or re-derive with FX before relying on GBP figures.
- **Portfolio export dates are Excel serial numbers** (epoch 1899-12-30; e.g. 45904 = 2025-09-04). The Plan 5 XLSX/CSV importer MUST convert these to ISO dates: `new Date(Date.UTC(1899,11,30) + serial*86400000).toISOString().slice(0,10)`.
- **`PortfolioDetails_*.xlsx` structure:** each ESPP monthly purchase = two rows (`Purchase` + `Company match`) sharing allocation date + cost basis. RSU awards ("Elevate SAP - RSU share-settled") = one row per vesting tranche. Columns: Allocation date, Plan, Instrument type, Instrument, Participation description, Contribution type, Strike price / Cost basis, Market price, Available from, Expiry date, Allocated/Outstanding/Available quantity, Estimated current outstanding/available value.
- **`CompletedTransactions_*.xlsx`** is a separate file for CGT disposals + dividends. Columns: Order reference, Date, Order type (Dividend/Sale), Quantity, Status, Execution price, Instrument, Product type, Strike price/cost basis, Taxes withheld, Fees, Net proceeds, Net units, FX currency, FX rate, Net proceeds after FX.
- **Payslip extraction is accurate** against the real SAP format (period, K-code tax codes, YTD figures, EE OWN SAP / ER OWN SAPMatc lines, salary sacrifice).
- **Tax code can be a K-code** (e.g. K289) — negative-allowance codes. Tax calc must handle K-codes (they add to taxable income rather than subtracting an allowance).

## Life events

Salary changes, pension contribution changes, RSU vest events, employment changes, new benefit enrolments. Stored in `life-events.json`. The forecaster uses these rather than assuming a fixed annual salary.

## UK tax rates (2025-26)

- Personal allowance: £12,570 (tapers above £100k)
- Basic rate 20%: £12,571–£50,270
- Higher rate 40%: £50,271–£125,140
- CGT annual exempt: £3,000 | basic rate 18% | higher rate 24%
- Dividend allowance: £500 | basic 8.75% | higher 33.75%
- Savings PSA: £1,000 (basic) / £500 (higher rate)

## Build progress

- **Plan 1 (Foundation)** ✅ — scaffold, auth, GitHub data layer, nav, PIN/setup, CI/CD
- **Plan 2 (Onboarding + Extraction)** ✅ — setup wizard, payslip upload, Claude extraction, scheme config, `useProfile`/`useTaxYear` hooks
- **Plan 3 (Dashboard + Income)** ✅ — live tax position, income breakdown + forecaster, band-aware dividend/savings tax
- **Plan 4 (Documents)** ✅ — upload/extract payslips, P11D, P60
- **Plan 5 (Share Schemes + CGT)** ✅ — lot register, portfolio XLSX import (Section 104), CGT "what if I sell", live price via Cloudflare Worker proxy (EUR-native + GBP reference)
- **Plan 6 (Tax Return)** ✅ — SA100/SA102/CGT summary, copy-to-HMRC, AES-GCM encrypted export
- **Plan 7 (Editable data foundation)** ✅ — editable stored data, salary onboarding step (`docs/superpowers/plans/2026-07-20-plan-7-editable-data-foundation.md`)
- **Plan 8 (Projection engine + presentation)** ✅ — `projectTaxYear` full-year projection, Dashboard/Income "This month / YTD / Projected" period toggle, future income events (`src/lib/projection.ts`, `src/hooks/useFutureEvents.ts`, `src/components/ui/PeriodToggle.tsx`)

Live-price + local-testing tooling (2026-07-23):
- **Live price default:** `src/screens/SharesScreen.tsx` bakes the deployed Cloudflare Worker (`https://taxtracker-price-proxy.spitefulgrain40.workers.dev`) as the default proxy so live SAP prices work with no per-device setup; a URL saved in Price settings overrides it. Proxy code + deploy guide in `price-proxy/`.
- **Dev seed:** `src/lib/devSeed.ts` — visit `?seed` (or `?seed=off`) in local dev to skip setup/PIN/onboarding and load dummy data (SAP profile, tax year, 3 lots). Hard-gated to `import.meta.env.DEV`; inert in staging/production. Saving is disabled in seed mode.

Key modules from Plan 2 available for reuse:
- `src/lib/claude.ts` — `extractPayslip()`, `parsePayslipResponse()`
- `src/lib/dataRepo.ts` — typed read/write for profile, taxYear, shareLots, lifeEvents (+ `emptyTaxYear`)
- `src/hooks/useProfile.ts`, `src/hooks/useTaxYear.ts` — GitHub-backed data hooks with loading/error/save/refetch

## Deployment

| Push to | Deploys to | URL |
|---|---|---|
| `dev` | Staging | https://spitefulgrain40.github.io/taxtracker-dev/ |
| `main` | Production | https://spitefulgrain40.github.io/taxtracker/ |

## Commands

```bash
npm run dev           # local dev server at localhost:5173/taxtracker/
npm run build         # production build to dist/
npm run test          # run all tests (214 passing)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

## Repo secrets (GitHub Actions)

- `STAGING_DEPLOY_TOKEN` — PAT used by the `dev` branch deploy job to push to `taxtracker-dev` repo

## Sensitive files — never commit

- `.env*` files
- Any file containing a real GitHub PAT, Claude API key, or NI number
- `data/` directories (data lives in the private `taxtracker-data` repo, not here)
