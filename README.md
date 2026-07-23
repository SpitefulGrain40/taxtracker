# TaxTracker

UK personal income tracker, tax forecaster, share scheme calculator, and Self Assessment tax return builder. A mobile-first PWA for Mike and Gemma.

**Live:** https://spitefulgrain40.github.io/taxtracker/
**Staging:** https://spitefulgrain40.github.io/taxtracker-dev/

---

## What this app does

- Tracks income from all sources: PAYE payslips, P11D benefits, dividends, savings interest, capital gains, and share schemes
- Forecasts estimated tax owed (including amounts outside PAYE), with band-aware dividend/savings stacking
- Tracks SAP ESPP and RSU share lots with CGT calculations (Section 104 pooling, per-lot cost basis). SAP shares are **EUR-denominated** (EquatePlus broker); the app shows EUR value plus a live GBP reference conversion at today's rate
- Generates a ready-to-submit Self Assessment summary (SA100/SA102/CGT) aligned to current HMRC format
- Plain English throughout — jargon buster tooltips on every tax term
- Two separate profiles (Mike + Gemma) sharing one private GitHub data repo

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS v4 (tokens in `src/index.css` `@theme` block) |
| Icons | Lucide React (2px stroke, no emojis) |
| Fonts | DM Serif Display (headings/numbers) + IBM Plex Mono (figures) + IBM Plex Sans (body) |
| Routing | React Router v6 |
| Data storage | Private GitHub repo (`taxtracker-data`) via GitHub REST API |
| Auth | PBKDF2 PIN hashing (Web Crypto API), stored in localStorage |
| AI extraction | Claude API (`claude-opus-4-8`) — payslips, P11D, P60 |
| Share prices | Cloudflare Worker proxy (`price-proxy/`) — previous-day close + live EUR→GBP rate |
| PWA | Web app manifest + service worker — installable on Android/iOS |
| Testing | Vitest + React Testing Library |
| Deployment | GitHub Actions → GitHub Pages |

---

## Design language

**Warm dark theme.** Copper amber accent, never purple-gradient AI clichés.

```
--color-accent:    #C8804A   copper amber (interactive, highlights)
--color-green:     #5BAD82   positive values, confirmed states
--color-yellow:    #C89A3A   warnings, estimates, action needed
--color-red:       #B05858   deductions, alerts
--color-blue:      #6B8FBF   info, neutral callouts
--color-surface:   #141416   cards
--color-bg:        #0C0C0E   page background
--color-text-1:    #F0EAE0   warm cream (primary text)
--color-text-2:    #857F77   secondary / labels
--color-text-3:    #48443E   dim
```

---

## Repositories

| Repo | Visibility | Purpose |
|---|---|---|
| `SpitefulGrain40/taxtracker` | Public | App source code — deployed to GitHub Pages |
| `SpitefulGrain40/taxtracker-data` | **Private** | JSON data files — never publicly visible |
| `SpitefulGrain40/taxtracker-dev` | Public | Staging preview — auto-deploys from `dev` branch |

---

## Branch strategy

| Branch | Deploys to | Purpose |
|---|---|---|
| `main` | Production (`/taxtracker/`) | Stable releases only |
| `dev` | Staging (`/taxtracker-dev/`) | Active development — all Plans 2–6 work here |

**Always work on `dev`.** Merge to `main` only when a plan is complete and tested on staging.

```bash
git checkout dev     # all new work goes here
git push             # auto-deploys to staging
```

---

## Getting started (new machine)

### Prerequisites

- Node 20+
- Git
- A GitHub account with access to `SpitefulGrain40/taxtracker-data`

### Clone and install

```bash
git clone https://github.com/SpitefulGrain40/taxtracker.git
cd taxtracker
git checkout dev
npm install
```

### Run locally

```bash
npm run dev
# App loads at http://localhost:5173/taxtracker/
```

### First run setup (in the browser)

The app will show a **Setup Screen** — fill in:

1. **Data repo:** `SpitefulGrain40/taxtracker-data`
2. **GitHub PAT:** Create a **fine-grained** token at https://github.com/settings/personal-access-tokens/new — scope it to **only** the `taxtracker-data` repo, with **Contents: Read and write**. (Avoid classic full-`repo` tokens.)
3. **Claude API key:** Get at https://console.anthropic.com/settings/keys — this is **separate** from Claude Pro; you need an API account (pay-as-you-go, ~£0.50/year usage)
4. **PIN:** 4–6 digits

> The GitHub PAT and Claude API key are stored in your browser's localStorage — never in the source code or the data repo.

---

## Project structure

```
src/
├── types/
│   └── index.ts              # All TypeScript types (Payslip, ShareLot, LifeEvent, Profile, etc.)
├── lib/
│   ├── auth.ts               # PBKDF2 PIN hashing + verification
│   ├── storage.ts            # localStorage helpers (PAT, Claude key, PIN hash)
│   ├── github.ts             # GitHub API client (read/write JSON to data repo)
│   └── taxYears.ts           # UK tax year utilities (6 April boundary, periods)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx      # Page wrapper with desktop/mobile nav
│   │   ├── DesktopNav.tsx    # Top nav (hidden on mobile)
│   │   └── MobileNav.tsx     # Bottom tab bar (hidden on desktop)
│   └── ui/
│       ├── StatCard.tsx      # Stat display card (label + big number + variant colour)
│       ├── JargonTip.tsx     # Dashed-underline tooltip for tax terms
│       ├── AlertStrip.tsx    # Yellow/copper alert banner
│       └── StatusDot.tsx     # Green/amber/grey status indicator
├── hooks/
│   └── useAuth.ts            # PIN auth state (unlocked, attemptUnlock, lock)
├── screens/
│   ├── PinScreen.tsx         # Full-screen PIN entry on app load
│   ├── SetupScreen.tsx       # First-run 3-step setup wizard
│   ├── OnboardingScreen.tsx  # Profile + scheme onboarding
│   ├── DashboardScreen.tsx   # Live tax position + Self Assessment alert
│   ├── IncomeScreen.tsx      # Income breakdown + forecaster
│   ├── DocumentsScreen.tsx   # Payslip/P11D/P60 upload + Claude extraction
│   ├── SharesScreen.tsx      # Lot register, live price, CGT calculator
│   └── TaxReturnScreen.tsx   # SA100/SA102/CGT summary + encrypted export
├── App.tsx                   # Router + auth gate (setup → PIN → screens)
├── main.tsx                  # React entry point
└── index.css                 # Tailwind v4 @import + @theme design tokens
```

---

## Data structure (private repo)

```
taxtracker-data/
└── data/
    ├── mike/
    │   ├── 2025-26.json       # Current tax year income, deductions, tax paid
    │   ├── 2024-25.json       # Prior years
    │   ├── share-lots.json    # Permanent lot register (all employers, all time)
    │   ├── life-events.json   # Salary changes, benefit changes, RSU vest events
    │   └── profile.json       # NI number, tax code, scheme configs, PIN hash
    └── gemma/
        ├── 2025-26.json
        ├── share-lots.json
        ├── life-events.json
        └── profile.json
```

---

## Tests

```bash
npm run test          # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

134 tests passing across the tax engine, CGT pooling, portfolio import, income summary, full-year projection, tax-return assembly, encrypted export, the price proxy client, auth, GitHub client, and UI components. `npm audit` reports 0 vulnerabilities.

---

## Build + deploy

```bash
npm run build     # outputs to dist/ — uses VITE_BASE_PATH env var (default /taxtracker/)
```

GitHub Actions handles deployment automatically:
- Push to `main` → production at `spitefulgrain40.github.io/taxtracker`
- Push to `dev` → staging at `spitefulgrain40.github.io/taxtracker-dev`

---

## What's built (all plans complete)

- [x] **Plan 1 — Foundation:** React + Vite + Tailwind v4 scaffold, all TypeScript types, GitHub data client, PBKDF2 PIN auth, tax year utilities, core UI components, desktop + mobile nav, PIN/setup screens, GitHub Actions CI/CD
- [x] **Plan 2 — Onboarding + Extraction:** first-run setup wizard, onboarding, share scheme config (ESPP match / discounted / RSU), payslip PDF/image upload → Claude extraction → confirm
- [x] **Plan 3 — Dashboard + Income:** live tax position, band-aware dividend/savings stacking, "what if I earned more" forecaster
- [x] **Plan 4 — Documents:** payslip / P11D / P60 upload + Claude extraction, review-and-confirm, immutable state updates
- [x] **Plan 5 — Share Schemes + CGT:** permanent lot register, portfolio XLSX import (fflate-based, no vulnerable deps), Section 104 pooling, live EUR price + GBP reference, "if I sell today" CGT calculator
- [x] **Plan 6 — Tax Return:** SA100/SA102/dividends/savings/CGT summary with plain-English box mapping, readiness score, copy-to-HMRC, AES-GCM encrypted export
- [x] **Plan 7 — Editable data foundation:** editable stored data, salary onboarding step
- [x] **Plan 8 — Projection engine + presentation:** `projectTaxYear` full-year projection, Dashboard/Income "This month / YTD / Projected" period toggle, future income events

The app is functionally complete and verified end-to-end against Mike's real SAP data. See `FULL_BUILD_TEST_REPORT.md` for the test breakdown.

## What's left before wider use

- **Live price is deployed and wired** — the Cloudflare Worker is baked in as the default proxy, so SAP prices work with no per-device setup (`price-proxy/` for redeploys / CORS changes)
- **Live document extraction** on the hosted app needs your GitHub PAT + Claude API key entered in the browser (see setup above)
- Optional refinements documented in `FULL_BUILD_TEST_REPORT.md` (CGT historical FX rates, 30-day CGT matching, discounted-ESPP cost basis for Gemma)

---

## Notes for Gemma's setup

Gemma uses the same data repo (`SpitefulGrain40/taxtracker-data`) with her own GitHub PAT and PIN. She needs:
- A GitHub account added as a collaborator on `taxtracker-data`
- Her own PAT (from her GitHub account) with `repo` scope
- A separate Claude API key (or share Mike's — usage is minimal)

Her data writes to `data/gemma/` — completely separate from Mike's.

---

## Claude API key vs Claude Pro

These are **separate products**:
- **Claude Pro** (claude.ai) — consumer chat subscription, not usable in apps
- **Claude API** (console.anthropic.com) — pay-as-you-go developer access (~£0.50/year for this app's usage)

Get an API key at https://console.anthropic.com/settings/keys
