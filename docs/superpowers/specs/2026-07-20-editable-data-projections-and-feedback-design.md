# TaxTracker — Editable data layer, full-year projections, account area & feedback

**Date:** 2026-07-20 · **Branch:** `dev` · **Status:** approved design, pre-plan

## Context

Testing the onboarding flow on a phone surfaced four issues, all tracing back to
one theme: the app captures data once during onboarding but has no persistent,
editable data layer, and it only ever shows a year-to-date snapshot.

1. **Onboarding discards the payslip.** Uploaded payslip figures are dropped;
   only a `Profile` is saved (never a `TaxYear`), so the Dashboard/Income show
   zeros. (Issue #1 — bug.)
2. **No way to view or edit your details** after onboarding. (Issue #3.)
3. **No account/"More" area** to house that editing. (Issue #3.)
4. **No way to factor in a known bonus** ahead of time to avoid a tax surprise.
   (Issue #2 — the app is strictly year-to-date.)

Plus two adjacent, already-tracked items folded into this effort's surface area:
in-app feedback (Issue #4) and Gemma's discounted ESPP (Issue #5). Ticker wiring
(Issue #6) is independent and blocked on a Cloudflare deploy — out of scope here
except for the drawer entry point.

## Ethos (hard guardrails, apply to every screen)

Continuing, easy-to-use, straightforward, **no bullshit**. Concretely:

- **Confirmed figures look confirmed; estimates always look like estimates.**
  Projected numbers get a distinct visual treatment (label + muted style) and a
  plain-English note explaining *why* it's an estimate. Never present a
  projection as a settled fact.
- No HMRC jargon in user-facing labels without a `JargonTip`.
- Lucide icons only, no emojis. Design tokens in `src/index.css @theme`.
- Never fabricate figures. A missing payslip yields an explicit empty state, not
  a plausible-looking zero.

## Goals

- Persist onboarding payslip data into a `TaxYear` so real numbers show.
- Let the user view and correct their profile and income/payslip figures.
- Add a full-year **projection** (with a bonus / pay-rise / RSU-vest events
  model) and a shortfall early-warning, presented beside the confirmed YTD.
- Add an in-app feedback button that writes to the private data repo.
- Restructure navigation to a 5-item bottom bar with a **More** drawer.
- Add general `espp-discounted` scheme support for Gemma (specifics entered later).

## Non-goals

- Ticker/price-proxy wiring (Issue #6) — separate, blocked.
- An automated feedback→Issues sync (maintainer triages manually).
- Same-day / 30-day CGT matching, historical-FX CGT filing figures (documented
  existing limitations, unchanged here).
- Multi-year projection. Projection is for the current tax year only.

---

## Navigation restructure

Bottom nav stays **5 items**: Dashboard · Income · Documents · Shares · **More**.
Tax Return leaves the bottom bar and becomes the **top** entry of the More
drawer. Same structure on desktop top-nav for one consistent mental model.

**More drawer** (slide-over / bottom-sheet), top → bottom:

| Entry | Behaviour |
|---|---|
| Tax Return | Navigates to `/return` (full screen) |
| Account & profile | Navigates to `/account` (full screen) |
| Price settings | Opens existing price settings (currently in Shares) |
| Submit feedback | Opens feedback form (in-drawer) |
| Switch profile | Profile switch action |
| Lock | Locks the app (returns to PIN) |

Routing: `/return` stays a route; add `/account`. The drawer is a UI overlay,
not a route. `Price settings` remains owned by the Shares screen; the drawer
entry deep-links to it to avoid a second source of truth.

---

## Data model changes

`src/types/index.ts`:

```ts
export type FutureIncomeEventType = 'bonus' | 'pay-rise' | 'rsu-vest'

export interface FutureIncomeEvent {
  id: string
  type: FutureIncomeEventType
  label: string
  amount: number          // GBP; for 'pay-rise' this is the new ANNUAL salary
  effectiveDate: string   // ISO; must fall within the tax year to affect it
  taxYear: TaxYearKey
  subjectToNI?: boolean    // default true for bonus/pay-rise; RSU vest via PAYE = true
}

export interface FeedbackEntry {
  id: string
  text: string
  screen: string          // route the user was on
  profileId: ProfileId
  appVersion: string
  createdAt: string       // ISO
}
```

`Profile` gains an optional stated base salary (a hard input for the projection,
preferred over the annualised payslip run-rate when present):

```ts
// Profile
baseAnnualSalary?: number   // GBP; user-stated current annual base salary
```

Data repo files (private `taxtracker-data`):

- `data/{profile}/future-events.json` — `FutureIncomeEvent[]`
- `feedback.json` (repo root, shared) — append-only `FeedbackEntry[]`

`src/lib/dataRepo.ts` gains typed helpers: `readFutureEvents`/`writeFutureEvents`,
`readFeedback`/`appendFeedback`, plus `emptyFutureEvents()`. Hooks:
`useFutureEvents(profileId)` mirroring the existing `useTaxYear` pattern
(loading/error/save/refetch).

---

## Feature 1 — Payslip persistence fix (Issue #1)

`OnboardingScreen` currently keeps only `{employerName, taxCode, niNumber}` from
the extracted payslip and saves only a `Profile`. Change:

- Carry the **full** extracted `Payslip` through onboarding state.
- On completion, in addition to saving the `Profile`, build a `TaxYear`
  (via `emptyTaxYear(currentKey)`) with one `EmploymentIncome`
  (`employerName`, `payslips: [payslip]`) and `saveTaxYear` it.
- The `Payslip` id/taxPeriod/taxYear/date fields (omitted by the extractor type)
  are filled in at persist time (period from the payslip, or default to current
  tax month; `taxYear` = current key).
- **Skip path:** if the user skips the payslip, save the `Profile` and an
  `emptyTaxYear`, and the Dashboard/Income render an **"Add your first payslip"**
  empty state (CTA → Documents) instead of zeros.

**Onboarding also optionally captures known salary inputs** (new light step, or
an addition to the income step): `baseAnnualSalary` (→ `Profile`) and an
**expected bonus** (amount + expected month → a `FutureIncomeEvent` of type
`bonus`). Both optional and skippable; when provided they seed the projection
immediately with hard numbers instead of relying on the annualised run-rate.

Regression test: onboarding with a payslip results in a persisted `TaxYear`
whose `summariseTaxYear` returns the payslip's YTD figures (not zero); a stated
base salary and expected bonus persist to `Profile` / `future-events.json`.

---

## Feature 2 — Projection engine (Issue #2)

New pure, fully-unit-tested module `src/lib/projection.ts`:

```ts
projectTaxYear(
  taxYear: TaxYear,
  events: FutureIncomeEvent[],
  today: Date,
  rates: TaxRates,
): TaxProjection
```

**Method:**

1. **Base annual salary:** prefer the user-stated `Profile.baseAnnualSalary`
   when present. Otherwise derive a **run-rate** from the latest payslip:
   `m = latest.taxPeriod` (1–12), `avgMonthlyGross = latest.ytdGross / m`.
   Remaining months `= 12 − m`.
2. **Projected employment gross** = `ytdGross + (statedMonthly or avgMonthlyGross)
   × (12 − m)` (stated base salary ÷ 12 gives `statedMonthly`), then apply future
   events falling within the tax year:
   - `pay-rise`: recompute the remaining-months run-rate from the new annual
     salary, effective from `effectiveDate`.
   - `bonus` / `rsu-vest`: add `amount` as a one-off.
3. **Projected annual tax due** = existing engine (`taxCalc.ts`), band-aware, on
   projected employment + dividends + savings + benefits (dividends/savings
   stacked as the Dashboard already does), using the profile's tax code /
   effective allowance. Projected **NI** via `employeeNI` on projected
   employment (one-off items flagged `subjectToNI` included).
4. **Projected PAYE withheld** = annualised YTD run-rate
   `(ytdTaxPaid + ytdEmployeeNI) / m × 12` **plus** estimated PAYE on future
   one-off events at the projected marginal rate.
5. **Shortfall** = `projectedTaxDue − projectedPAYEWithheld`. Self-assessed items
   (dividends, savings, CGT) are inherently "to set aside" and included in due
   but not in PAYE-withheld, so they surface in the shortfall. Result carries
   `{ projectedGross, projectedTaxDue, projectedPAYE, shortfall, marginalRate,
   assumptions[] }`.

**Assumption note (surfaced in UI):** run-rate assumes the latest month is
representative; PAYE-withholding estimation is approximate. This is explicitly an
estimate — see Ethos. Edge cases tested: `m = 0`/no payslips (projection
unavailable, show YTD only), single payslip, bonus crossing a band, tapered
allowance, K-code.

---

## Feature 3 — Dashboard & Income presentation

- A **This month / YTD / Projected** segmented toggle drives the headline
  figures. (All three periods are modelled, so the toggle is cheap and covers
  the "if side-by-side is cramped" fallback in one move.)
- Default view shows confirmed **YTD** with a **Projected year-end** panel
  beside/below it (design C), the projected panel visibly marked as an estimate
  with the shortfall call-out ("set aside ~£X so April isn't a surprise").
- `ForecastSlider` stays as a live what-if, now seeded from the projected base
  rather than YTD.
- Empty state when no payslip exists (from Feature 1).

---

## Feature 4 — Account / Settings area (Issue #3)

- New `MoreDrawer` component (slide-over) triggered by the 5th nav item.
- New `/account` screen (`AccountScreen`): view and edit
  - Profile: `firstName`, `niNumber`, `taxCode`, `baseAnnualSalary`, schemes
    (add/edit/remove `ShareSchemeConfig` — type, discount %, currency, exchange,
    broker; see Feature 6).
  - Income corrections: edit the saved payslip's figures (basic salary, tax
    paid, NI, YTD gross, tax code…) — the "correct anything that isn't quite
    right" need. Saves via `useTaxYear.saveTaxYear`.
  - Future income events: add/edit/remove `FutureIncomeEvent`s (this is where a
    bonus is entered).
- All edits validated; monetary inputs in `font-mono`; save + error states.

---

## Feature 5 — Feedback (Issue #4)

- `Submit feedback` in the More drawer opens a small form (free text + the
  captured `screen`). On submit, appends a `FeedbackEntry` to `feedback.json` in
  the private data repo via the existing `GitHubDataClient` and minimal-scope
  PAT — **no new token scope, no backend**.
- Confirmation toast; graceful error if offline / not configured.
- Maintainer reads `feedback.json` during sessions and triages into GitHub
  Issues (labelled `feedback`).

---

## Feature 6 — Flexible discounted-ESPP support (`espp-discounted`) (Issue #5)

**Principle: don't hardcode anyone's scheme.** Scheme shape varies company to
company and both users may change jobs, so schemes are **user-configured data**,
not code. `ShareSchemeConfig` is already general (`schemeType`, `discountRate`,
`currency`, `exchange`, `broker`, `active`) — the work is (a) making it fully
**editable in the Account screen** and (b) handling `espp-discounted` in the tax
logic.

- **Editable scheme config (Account screen):** add / edit / remove schemes —
  pick `schemeType`, set `discountRate`, `currency`, `exchange`, `broker`. When
  either user changes jobs they reshape their own schemes; no code change.
- **Tax logic:** income tax on the **discount value at purchase**
  (`marketPrice × discountRate × qty`); CGT cost basis = **market value at
  purchase** (per the scheme rules table in CLAUDE.md). FX machinery kept — the
  scheme `currency` (e.g. USD) converts to GBP via the existing FX path.
- **Gemma's initial values** are just data she enters: ~15% discount, USD,
  converted. Ticker / broker / holdings supplied and imported when ready — no
  blocker for building the logic.

---

## Testing strategy

- **TDD** for pure logic: `projection.ts` (thorough — the numeric heart),
  payslip→`TaxYear` mapping, discounted-ESPP cost-basis/discount-income.
- Component tests: Account edit flow (profile + payslip correction saves),
  feedback submit (appends to feedback file), More drawer navigation, period
  toggle.
- The existing **104 tests stay green**.
- After merge to `dev`: staging deploy, then a phone re-test of the full
  onboarding → dashboard → edit → feedback loop.

## Rollout

All work on `dev` → staging (`taxtracker-dev`) for phone re-test → merge to
`main` for production once verified (the user's step 6).

## Open items (not blockers)

- Gemma's ESPP specifics (Feature 6 data).
- Cloudflare `workers.dev` URL for ticker wiring (Issue #6, separate chat).

## Issue mapping

| Issue | Feature |
|---|---|
| #1 bug | Feature 1 (payslip persistence) |
| #2 | Feature 2 + 3 (projection + presentation) |
| #3 | Feature 4 (account area + nav) |
| #4 | Feature 5 (feedback) |
| #5 | Feature 6 (Gemma ESPP) |
| #6 | Out of scope (ticker, blocked) |
