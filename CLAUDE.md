# TaxTracker — Claude Code Context

UK personal tax tracker PWA for Mike and Gemma. React + Vite + Tailwind CSS v4, deployed to GitHub Pages, data stored in a private GitHub repo.

## Critical rules — read before any edit

- **Always work on `dev` branch.** Never commit directly to `main`.
- **No emojis in the UI.** Lucide React icons only — consistent 2px stroke weight throughout.
- **Plain English first.** Every tax term that could confuse a layman needs a `JargonTip` tooltip. Never add HMRC jargon to user-facing labels without a plain English alternative.
- **Design tokens live in `src/index.css` `@theme` block** — not `tailwind.config.ts`. Tailwind v4 does not read `tailwind.config.ts` for tokens.
- **No backend.** This is a static PWA. No server, no environment variables at runtime, no secrets in source code.
- **Secrets in localStorage only** — GitHub PAT and Claude API key are entered by the user and stored in `localStorage`. They must never appear in source code, git history, or the data repo.
- **Run `npm run test` after any change to `src/lib/` or `src/components/ui/`.** All 19 tests must pass before committing.

## Project identity

**Users:** Mike (Android, Windows PC) and Gemma (iPhone). Both use the same private data repo but separate profiles.

**Core screens (5):**
1. Dashboard — live running tax position, action items
2. Income — all income sources, forecaster
3. Documents — upload payslips/P11D/P60/CSV, Claude AI extraction
4. Share Schemes — lot register, CGT calculator, "what if I sell?" tool
5. Tax Return — SA100/SA102/CGT summary, copy-to-HMRC, encrypted export

**What's built (Plan 1):** Scaffold, types, auth, GitHub API client, tax year utilities, UI components, navigation, PIN/setup screens, routing, CI/CD.

**Current branch:** `dev` — all Plans 2–6 go here.

## Tech stack

- React 18 + Vite + TypeScript
- Tailwind CSS v4 — tokens in `src/index.css @theme`, NOT tailwind.config.ts
- Lucide React — icons only, never emojis
- React Router v6 — `basename="/taxtracker"`
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
| `src/App.tsx` | Auth gate: setup → PIN → router |
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

**Mike's scheme:** SAP ESPP employer-match, NYSE-listed (USD). RSU vests start 2026-27 tax year.
**Gemma's scheme:** ESPP discounted-purchase. Leaving after next vest. Future employer scheme to be added.

Lots are employer-agnostic — tagged by employer + scheme type. Old lots persist permanently when changing jobs.

## Life events

Salary changes, pension contribution changes, RSU vest events, employment changes, new benefit enrolments. Stored in `life-events.json`. The forecaster uses these rather than assuming a fixed annual salary.

## UK tax rates (2025-26)

- Personal allowance: £12,570 (tapers above £100k)
- Basic rate 20%: £12,571–£50,270
- Higher rate 40%: £50,271–£125,140
- CGT annual exempt: £3,000 | basic rate 18% | higher rate 24%
- Dividend allowance: £500 | basic 8.75% | higher 33.75%
- Savings PSA: £1,000 (basic) / £500 (higher rate)

## Plan 2 (next)

Onboarding wizard + document upload + Claude API extraction:
- Payslip-first onboarding (auto-populates profile from first payslip upload)
- Share scheme configuration per employer
- Claude API extraction: payslip → structured fields → user confirms
- P11D, P60, stock CSV import
- Life event detection (salary change, RSU vest) from payslip

## Deployment

| Push to | Deploys to | URL |
|---|---|---|
| `dev` | Staging | https://spitefulgrain40.github.io/taxtracker-dev/ |
| `main` | Production | https://spitefulgrain40.github.io/taxtracker/ |

## Commands

```bash
npm run dev           # local dev server at localhost:5173/taxtracker/
npm run build         # production build to dist/
npm run test          # run all tests (19 passing)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

## Repo secrets (GitHub Actions)

- `STAGING_DEPLOY_TOKEN` — PAT used by the `dev` branch deploy job to push to `taxtracker-dev` repo

## Sensitive files — never commit

- `.env*` files
- Any file containing a real GitHub PAT, Claude API key, or NI number
- `data/` directories (data lives in the private `taxtracker-data` repo, not here)
