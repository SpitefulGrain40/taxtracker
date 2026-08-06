# Plan 13: Multiple tax years + projection UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From testing feedback: let the user view/enter any tax year via a selector so they can review past years and estimate a rebate (#13); rework the useless "This month" period into a real month picker (#14); stop the Projected view repeating the YTD cards (#15); and show an itemised, expandable breakdown of how the projection is composed (#16).

**Architecture:** A single shared "selected tax year" (React context, persisted) drives which year every year-scoped screen reads via the existing `useTaxYear(profileId, year)`. The projection engine gains a composition breakdown. The Dashboard/Income period system becomes Monthly (a per-payslip month picker) / YTD / Projected (which now hides the YTD cards and can expand the breakdown).

**Tech Stack:** React 18, TypeScript strict, Tailwind v4, Lucide, Vitest. Reuses `useTaxYear` (already year-parameterised), `projection.ts`, `taxYears.ts`, `PeriodToggle`, the screens.

## Global Constraints

- Work on branch `dev`. Never commit to `main`. Commit with **explicit file paths** — never `git add -A`/`.`/`-am`.
- No emojis (Lucide only); Tailwind design tokens only (no inline hex); strict TS (`noUnusedLocals`/`noUnusedParameters`).
- **Plain English first** — layman-facing tax terms need a `JargonTip`. Estimates look like estimates (yellow + label). Never fabricate figures; missing data → explicit empty state.
- Run `npm run test` (currently **214**) and `npm run build` before every commit.
- One account per install — do not reintroduce profile switching.

---

## Task 1: Selected-tax-year context, selector & year list (#13 foundation)

**Files:**
- Modify: `src/lib/taxYears.ts` + `src/lib/taxYears.test.ts`
- Create: `src/hooks/useSelectedTaxYear.tsx`
- Create: `src/components/ui/TaxYearSelector.tsx`
- Modify: `src/AppRouter.tsx`

**Interfaces:**
- Produces: `recentTaxYears(count: number): TaxYearKey[]`; `TaxYearProvider`, `useSelectedTaxYear(): { year: TaxYearKey; setYear: (y: TaxYearKey) => void; years: TaxYearKey[] }`; `TaxYearSelector` component (no props — reads context).

- [ ] **Step 1: Add `recentTaxYears` + test.** In `taxYears.ts`:

```ts
/** The current tax year key plus the previous (count-1) years, newest first. */
export function recentTaxYears(count: number): TaxYearKey[] {
  const [startStr] = getCurrentTaxYear().split('-')
  const start = parseInt(startStr, 10)
  return Array.from({ length: count }, (_, i) => {
    const y = start - i
    return `${y}-${String(y + 1).slice(-2)}` as TaxYearKey
  })
}
```
Test in `taxYears.test.ts`: `recentTaxYears(4)[0]` equals `getCurrentTaxYear()`, length is 4, and the second entry is the prior year (e.g. current `2026-27` → `['2026-27','2025-26','2024-25','2023-24']` — compute expected from `getCurrentTaxYear()`, don't hardcode the date).

- [ ] **Step 2: Context/provider** — `src/hooks/useSelectedTaxYear.tsx`:

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { TaxYearKey } from '../types'
import { getCurrentTaxYear, recentTaxYears } from '../lib/taxYears'

const KEY = 'tt_selected_year'
const YEARS = recentTaxYears(4)

interface Ctx { year: TaxYearKey; setYear: (y: TaxYearKey) => void; years: TaxYearKey[] }
const TaxYearContext = createContext<Ctx | null>(null)

export function TaxYearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<TaxYearKey>(() => {
    const stored = localStorage.getItem(KEY)
    return (stored && /^\d{4}-\d{2}$/.test(stored)) ? (stored as TaxYearKey) : getCurrentTaxYear()
  })
  const setYear = (y: TaxYearKey) => { localStorage.setItem(KEY, y); setYearState(y) }
  return <TaxYearContext.Provider value={{ year, setYear, years: YEARS }}>{children}</TaxYearContext.Provider>
}

export function useSelectedTaxYear(): Ctx {
  const ctx = useContext(TaxYearContext)
  if (!ctx) throw new Error('useSelectedTaxYear must be used within TaxYearProvider')
  return ctx
}
```

- [ ] **Step 3: Selector component** — `src/components/ui/TaxYearSelector.tsx`: a styled `<select>` bound to the context (`value={year}`, `onChange` → `setYear`), options from `years` labelled with `getTaxYearLabel`. Small, mono, matches the header treatment (use existing tokens; a bordered `bg-surface` select with `text-text-1`). Include a `JargonTip` on "tax year" (6 April–5 April) next to it, or a title attr — keep it plain-English.

- [ ] **Step 4: Wire the provider** — in `src/AppRouter.tsx`, wrap the `<AppShell>`/routes with `<TaxYearProvider>` (inside `<BrowserRouter>`).

- [ ] **Step 5:** `npm run build` + `npm run test` (215) pass.
- [ ] **Step 6: Commit** — `git add src/lib/taxYears.ts src/lib/taxYears.test.ts src/hooks/useSelectedTaxYear.tsx src/components/ui/TaxYearSelector.tsx src/AppRouter.tsx` → `git commit -m "feat: selected-tax-year context + selector + recentTaxYears (#13)"`

---

## Task 2: Thread the selected year through the screens (#13)

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`, `src/screens/IncomeScreen.tsx`, `src/screens/DocumentsScreen.tsx`, `src/screens/TaxReturnScreen.tsx`, `src/screens/AccountScreen.tsx`

**Interfaces:** Consumes `useSelectedTaxYear()` (Task 1).

For each screen: read `const { year } = useSelectedTaxYear()` and pass it to `useTaxYear(profileId, year)` (the hook already accepts a year and refetches when it changes). Then:
- **Dashboard, Income, Documents, Tax Return:** replace the static year label in the header (`{getCurrentTaxYear()}` / `{getTaxYearLabel(key)}`) with `<TaxYearSelector />`. All year-derived display (`key`) should use the selected `year`, not `getCurrentTaxYear()`.
- **AccountScreen:** its `useTaxYear` becomes year-scoped so the payslip editor corrects the selected year. (No selector needed in Account itself — it follows the shared selection; optionally show the selected year label.)
- **DocumentsScreen:** uploads already append to the loaded `taxYear` — now the selected year — so historical payslips can be added by selecting a past year first. Leave the pay-date-derived per-payslip `taxYear` field logic as-is.
- **SharesScreen / OnboardingScreen:** leave on current year (lots are cross-year; onboarding always sets up the current year).

- [ ] **Step 1:** Thread `year` + selector into the five screens.
- [ ] **Step 2:** `npm run build` (clean — catches a missed prop) + `npm run test` (215; existing DashboardScreen empty-state test still passes — it mocks `useTaxYear`, so wrap the render in `<TaxYearProvider>` if the component now needs the context, OR the test may need the provider; update the test to wrap with `TaxYearProvider` and keep its assertion).
- [ ] **Step 3: Commit** — explicit paths (+ the DashboardScreen test if updated) → `git commit -m "feat: scope Dashboard/Income/Documents/Return/Account to the selected tax year (#13)"`

---

## Task 3: Projection composition breakdown (#16, pure engine)

**Files:**
- Modify: `src/lib/projection.ts` + `src/lib/projection.test.ts`

**Interfaces:** `TaxProjection` gains `breakdown: { baseAnnualised: number; items: ProjectionItem[] }` where `ProjectionItem = { id: string; type: 'base' | FutureIncomeEventType; label: string; amount: number }`. The items' amounts + nothing-left-over sum to `projectedGross` (i.e. `baseAnnualised` is included as the first item AND surfaced separately).

Requirements: inside `projectTaxYear`, after computing `projectedGross`, build:
- `baseAnnualised = ytdGross + <the plain run-rate future> ` (the projected employment gross **excluding** future one-off/pay-rise-delta events) — i.e. `ytdGross + monthlyForFuture * (12 - m)`.
- `items`: first a `{ id:'base', type:'base', label:'Base pay (annualised)', amount: baseAnnualised }`, then one item per applied future event: bonus / rsu-vest use their `amount`; a pay-rise uses its **delta above base** (`futureGross - monthlyForFuture*(12-m)` attributable to that rise — if multiple rises, the total pay-rise delta may be a single `{ type:'pay-rise', label:'Pay rise', amount: <delta> }`). Ensure `baseAnnualised + sum(non-base item amounts) === projectedGross` (within rounding).
- When `!available`, `breakdown = { baseAnnualised: 0, items: [] }`.

Add tests: with a bonus, `items` includes a `bonus` line equal to the bonus amount and the item amounts sum to `projectedGross`; base-only case has a single `base` item equal to `projectedGross`.

- [ ] **Step 1:** Write failing tests. **Step 2:** run, fail. **Step 3:** implement. **Step 4:** run, pass (215+). **Step 5:** `npm run build`. **Step 6: Commit** — `git add src/lib/projection.ts src/lib/projection.test.ts` → `git commit -m "feat: projection returns an itemised composition breakdown (#16)"`

---

## Task 4: Dashboard period rework — Monthly picker, declutter, breakdown UI (#14 #15 #16)

**Files:**
- Modify: `src/components/ui/PeriodToggle.tsx` + `src/components/ui/PeriodToggle.test.tsx`
- Create: `src/lib/payslipFigures.ts` + `src/lib/payslipFigures.test.ts`
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:** `payslipPeriodFigures(p: Payslip): { gross: number; tax: number; ni: number }`; `PeriodToggle` keeps `Period = 'month' | 'ytd' | 'projected'` but the `'month'` label becomes **"Monthly"**.

- [ ] **Step 1: `payslipFigures.ts` + test** — a pure helper for a single payslip's own-period figures (NOT cumulative): `gross = basicSalary + carAllowance + otherPayments.reduce(sum)`, `tax = taxPaid`, `ni = employeeNI`. Unit-test it.

- [ ] **Step 2: PeriodToggle relabel** — change the `'month'` option label from "This month" to "Monthly". Update `PeriodToggle.test.tsx`'s label expectation accordingly (keep the value `'month'`).

- [ ] **Step 3: Dashboard rework** — read the current file fully, then:
  - **Monthly (`period==='month'`):** render a month dropdown of the payslips present (sorted by `taxPeriod`, labelled by month — derive a month name from `taxPeriod`: period 1 = April … 12 = March, e.g. a small `taxPeriodMonthLabel(p)` inline or in `taxYears.ts`), defaulting to the latest. Show that payslip's `payslipPeriodFigures` as the headline cards (Gross this month / Tax this month / NI this month). If there are no payslips, show the existing empty state. This replaces the old "monthly breakdown isn't available yet" note.
  - **YTD (`period==='ytd'`):** the existing confirmed YTD stat-card grid (unchanged).
  - **Projected (`period==='projected'`):** show ONLY the projected panel — **hide the YTD stat-card grid** (declutter #15). Under the projected cards, add an expandable **"How this is worked out"** section (a `<details>`/toggle) listing `projection.breakdown.items` (label + `gbp(amount)`) — the itemised base + bonus/pay-rise/RSU lines (#16), with the estimate treatment.
  - Keep the `PeriodToggle` in the header; the `needsSA` alert and the projected panel's estimate labelling stay.

- [ ] **Step 4:** `npm run build` + `npm run test` (the Dashboard empty-state + PeriodToggle tests still green after the relabel/rework). **Step 5: Commit** — explicit paths → `git commit -m "feat: Dashboard Monthly month-picker, declutter Projected, itemised breakdown (#14 #15 #16)"`

---

## Task 5: Income period rework — Monthly + declutter (#14 #15)

**Files:**
- Modify: `src/screens/IncomeScreen.tsx`

Mirror Task 4's period behaviour on the Income screen: **Monthly** shows the selected month's own-period figures (reuse `payslipPeriodFigures` + the same month dropdown pattern) instead of the "monthly breakdown isn't available yet" note; **Projected** hides the confirmed YTD income rows/total and shows the projected employment income (with its estimate caption); **YTD** unchanged. Keep the `ForecastSlider` and its estimate caption.

- [ ] **Step 1:** Rework the Income period rendering. **Step 2:** `npm run build` + `npm run test` pass. **Step 3: Commit** — `git add src/screens/IncomeScreen.tsx` → `git commit -m "feat: Income Monthly month-picker + declutter Projected (#14 #15)"`

---

## Task 6: Deploy + verify

**Files:** none.

- [ ] **Step 1:** `git status -s` clean, `git push origin dev`.
- [ ] **Step 2:** Confirm staging deploy green (`gh run watch …`). **If GitHub's hosted-runner outage is still ongoing** (job "not acquired by a hosted runner"), fall back to the manual staging deploy: `MSYS_NO_PATHCONV=1 VITE_BASE_PATH=/taxtracker-dev/ npm run build`, `sed -i 's|/taxtracker/|/taxtracker-dev/|g' dist/manifest.json dist/index.html`, ensure `dist/.nojekyll`, then force-push `dist` as an orphan `gh-pages` to `SpitefulGrain40/taxtracker-dev` (init git in dist, commit, `git push -f "https://x-access-token:$(gh auth token)@github.com/SpitefulGrain40/taxtracker-dev.git" gh-pages`).
- [ ] **Step 3:** Comment + close #13, #14, #15, #16 (leave open if you prefer the user's device confirmation first — comment either way).

---

## Self-review notes

- **#13:** Tasks 1–2 — shared selected-year context + selector, threaded into every year-scoped screen; `useTaxYear` was already year-parameterised so historical years read/write `data/<id>/<year>.json`.
- **#14:** Task 4/5 — "This month" → "Monthly" with a per-payslip month picker showing own-period figures (fixes the always-£0 problem).
- **#15:** Task 4/5 — Projected view hides the confirmed YTD cards.
- **#16:** Task 3 (engine breakdown) + Task 4 (expandable UI) — the bonus/events are itemised.
- **Deferred (note for a follow-up, not this plan):** per-year Documents/Account data entry works via selecting the year first; a dedicated "start a new/blank year" affordance and Shares/CGT per-year disposal scoping are separate enhancements. Onboarding still sets up the current year only.
- **Test touch-points:** DashboardScreen.test and PeriodToggle.test may need the `TaxYearProvider` wrapper / the relabelled option — update them minimally, keep their assertions.
