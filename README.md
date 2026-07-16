# TaxTracker

UK personal income tracker, tax forecaster, share scheme calculator, and Self Assessment tax return builder. A mobile-first PWA for Mike and Gemma.

**Live:** https://spitefulgrain40.github.io/taxtracker/
**Staging:** https://spitefulgrain40.github.io/taxtracker-dev/

---

## What this app does

- Tracks income from all sources: PAYE payslips, P11D benefits, dividends, savings interest, capital gains, and share schemes
- Forecasts estimated tax owed (including amounts outside PAYE)
- Tracks SAP ESPP and RSU share lots with CGT calculations (USD→GBP, per-lot cost basis)
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
2. **GitHub PAT:** Create at https://github.com/settings/tokens/new — scope: `repo` (full access)
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
│   ├── DashboardScreen.tsx   # (Plan 3 — placeholder)
│   ├── IncomeScreen.tsx      # (Plan 3 — placeholder)
│   ├── DocumentsScreen.tsx   # (Plan 4 — placeholder)
│   ├── SharesScreen.tsx      # (Plan 5 — placeholder)
│   └── TaxReturnScreen.tsx   # (Plan 6 — placeholder)
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

19 tests passing across:
- `src/lib/auth.test.ts` — PBKDF2 hashing + verification
- `src/lib/github.test.ts` — GitHub API client (mocked)
- `src/lib/taxYears.test.ts` — Tax year boundary logic
- `src/components/ui/StatCard.test.tsx` — StatCard rendering
- `src/components/ui/JargonTip.test.tsx` — Tooltip hover behaviour

---

## Build + deploy

```bash
npm run build     # outputs to dist/ — uses VITE_BASE_PATH env var (default /taxtracker/)
```

GitHub Actions handles deployment automatically:
- Push to `main` → production at `spitefulgrain40.github.io/taxtracker`
- Push to `dev` → staging at `spitefulgrain40.github.io/taxtracker-dev`

---

## What's built (Plan 1 complete)

- [x] React + Vite + Tailwind v4 scaffold with design tokens
- [x] All TypeScript types for every data shape
- [x] GitHub API data client (read/write JSON to private repo)
- [x] PBKDF2 PIN hashing (Web Crypto API) with atomic localStorage storage
- [x] UK tax year utilities (6 April boundary, tax periods)
- [x] Core UI components (StatCard, JargonTip, AlertStrip, StatusDot)
- [x] Desktop top nav + mobile bottom tab bar
- [x] PIN entry screen + first-run setup wizard
- [x] App router with setup gate → PIN gate → 5 placeholder screens
- [x] GitHub Actions deployment (production + staging)

## What's next (Plan 2)

Onboarding wizard + document upload + Claude API extraction:
- Profile setup wizard (seeded from payslip upload)
- Share scheme configuration (ESPP match, ESPP discounted, RSU)
- Payslip PDF upload → Claude extracts fields → user confirms
- P11D and P60 extraction
- Stock plan CSV import for share lot register

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
