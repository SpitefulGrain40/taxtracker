# Picking up TaxTracker on your personal PC

_Last handoff: 23 July 2026 · branch `dev` · everything below is pushed to GitHub._

> **Update 23 July 2026:** The share-price proxy is **deployed and wired** — the
> Worker (`https://taxtracker-price-proxy.spitefulgrain40.workers.dev`) is baked
> in as the default, so live SAP prices work with no per-device setup. A
> black-screen-after-onboarding bug on staging was fixed (router basename now
> derives from the deploy base). Plans 7 (editable data) and 8 (projection engine
> + Dashboard/Income period toggle) landed. A dev-only `?seed` mode lets you skip
> onboarding with dummy data while testing — see "Local testing" below. Still
> open: enter your real credentials (Step 3) and promote `dev`→`main` (Step 4).

This is your "where did I leave off and how do I continue" guide. Everything is committed and pushed to `dev`, so you start by cloning and pulling.

---

## TL;DR — the state of things

- **The app is functionally complete.** All six build plans are done. 103 tests pass, clean build, `npm audit` = 0 vulnerabilities.
- **Verified against your real SAP data** (payslip, P11D, P60, portfolio export) and your **live credentials passed 4/4** (GitHub read + write, Claude API).
- **Remaining**, none blocking, all covered below:
  1. ~~Deploy the share-price proxy~~ — **done** (deployed + baked in as default; Step 2 kept below for reference / redeploys)
  2. Enter your GitHub PAT + Claude key in the browser on the hosted app (Step 3)
  3. Optional: merge `dev` → `main` to promote to production when you're happy (Step 4)

---

## Step 1 — Clone and run (fresh machine)

```bash
# Prerequisites: Node 20+, Git, a GitHub account with access to the repos
git clone https://github.com/SpitefulGrain40/taxtracker.git
cd taxtracker
git checkout dev          # ALL work is on dev — never commit to main directly
git pull                  # make sure you have the latest
npm install
npm run dev               # http://localhost:5173/taxtracker/
```

Quick sanity check that the checkout is healthy:

```bash
npm run test              # expect 134 passing
npm run build             # expect a clean build
```

### Testing without re-onboarding (dev only)

Onboarding on every test is painful, so local dev has a seed mode:

- `http://localhost:5173/taxtracker/?seed` — skips setup / PIN / onboarding and
  loads dummy data (SAP EUR ESPP profile, a tax year, 3 share lots).
- `http://localhost:5173/taxtracker/?seed=off` — turns it back off.

Hard-gated to the dev build (`import.meta.env.DEV`), so it never ships to staging
or production. Saving is disabled in seed mode (no real data repo).

---

## Step 2 — Deploy the share-price proxy (one-time, ~5 min)

Live share prices need a tiny serverless proxy (a static site can't fetch stock prices directly — browsers block it). The code is ready in `price-proxy/`; you just deploy it to your own free Cloudflare account.

```bash
npm install -g wrangler          # Cloudflare's CLI
wrangler login                   # opens browser, log into your Cloudflare account
cd price-proxy
wrangler deploy
```

It prints a URL like `https://taxtracker-price-proxy.<your-subdomain>.workers.dev`. **Copy it.**

Then in the app: open the **Share Schemes** screen → **Price settings** → paste that URL and set the ticker (`SAP.DE`). It's stored only in your browser. Full details are in `price-proxy/README.md`.

> Your SAP shares are **EUR-denominated** — the app shows the EUR value as primary and a **live GBP reference** conversion at today's rate. (The GBP figure is for reference; the real CGT filing figure uses the exchange rate on the actual purchase/sale dates.)

---

## Step 3 — Run the app with your real credentials

When you open the app (locally or on staging), the setup screen asks for:

1. **Data repo:** `SpitefulGrain40/taxtracker-data`
2. **GitHub PAT:** a **fine-grained** token scoped to **only** `taxtracker-data`, permission **Contents: Read and write**. Create at https://github.com/settings/personal-access-tokens/new
3. **Claude API key:** from https://console.anthropic.com/settings/keys (this is API access, **not** your Claude Pro subscription)
4. **A PIN** (4–6 digits)

These live only in your browser's localStorage — never in the code or the data repo.

### Verifying credentials from the command line (optional)

There's a helper that checks your keys work without printing their values:

```bash
cp .env.example .env.test.local        # then paste your PAT + Claude key into .env.test.local
node scripts/live-verify.mjs           # prints only PASS/FAIL
```

`.env.test.local` is gitignored — it can never be committed. **This last ran green: 4/4 (GitHub read, GitHub write, Claude API).**

---

## Step 4 — Promote to production (when you're happy)

Everything is on `dev`, which auto-deploys to **staging**: https://spitefulgrain40.github.io/taxtracker-dev/

When you've tested on staging and want it live:

```bash
git checkout main
git merge dev
git push                  # auto-deploys to production: spitefulgrain40.github.io/taxtracker/
git checkout dev          # go back to dev for any further work
```

---

## Where everything is

| What | Where |
|---|---|
| Project context for Claude Code | `CLAUDE.md` (read this first in any new Claude session) |
| Full test report | `FULL_BUILD_TEST_REPORT.md` |
| Build plans (all 6) | `docs/superpowers/plans/` |
| Price proxy + deploy guide | `price-proxy/` and `price-proxy/README.md` |
| Credential check script | `scripts/live-verify.mjs` |
| App source | `src/` (see README for the structure map) |

## Continuing with Claude Code on your PC

Open the `taxtracker` folder in Claude Code. It reads `CLAUDE.md` automatically for full project context (rules, design system, tax logic, what's built). Just describe what you want next — e.g. "deploy the price proxy and wire it up," "run the real-payslip extraction test," or "start on the discounted-ESPP cost basis for Gemma."

## Security reminders

- The **test credentials** used from the previous machine were short-lived. If you haven't already: **revoke that GitHub PAT** and **rotate/delete that Claude key**, then create fresh ones on your PC.
- Never paste real secrets into a chat or commit them. Use the browser setup screen (for the app) or `.env.test.local` (for the verify script).
- `.gitignore` already blocks `.env*`, `*.local`, and the `data/` directory.

---

## Known limitations (none are blockers — see FULL_BUILD_TEST_REPORT.md for detail)

1. **Live price** is deployed and wired (default Worker baked in). If the Worker is ever unreachable, the app falls back to your last purchase price and invites you to enter one manually.
2. **CGT uses Section 104 pooling** (the correct UK default) — it doesn't model same-day / 30-day matching.
3. **GBP conversion is at today's rate for display.** The real CGT filing figure needs the FX rate on the actual acquisition/disposal dates — a documented refinement.
4. **Discounted-ESPP cost basis** (Gemma's future scheme) needs a small importer tweak when she's added.
