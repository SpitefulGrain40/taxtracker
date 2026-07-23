# Plan 8: Projection engine + Dashboard/Income presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure full-year tax projection engine and surface it on the Dashboard and Income screens as a clearly-labelled year-end estimate beside the confirmed year-to-date figures, with a This month / YTD / Projected toggle and a shortfall ("set aside") call-out.

**Architecture:** A pure `projection.ts` module annualises the pay run-rate (preferring a user-stated base salary), applies future income events (bonus / pay-rise / RSU vest), and reuses the existing `taxCalc.ts` engine to compute projected tax due, estimated PAYE withheld, and the resulting shortfall. A presentational `PeriodToggle` drives which period the headline shows. Screens consume `projectTaxYear` and `useFutureEvents`.

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`), Tailwind v4, Lucide React, Vitest. Reuses `src/lib/taxCalc.ts`, `src/lib/taxRates.ts`, `src/lib/incomeSummary.ts`, `src/lib/taxYears.ts`, `src/hooks/useFutureEvents.ts` (Plan 7), `src/hooks/useTaxYear.ts`, `src/hooks/useProfile.ts`, `src/components/ui/StatCard.tsx`, `src/components/ui/JargonTip.tsx`.

## Global Constraints

- Work on branch `dev`. Never commit to `main`.
- No emojis in the UI — Lucide React icons only, 2px stroke.
- Design tokens live in `src/index.css @theme`. Estimates use the **yellow** token (`#C89A3A`, warnings/estimates); confirmed figures use default/green.
- **Confirmed figures look confirmed; estimates always look like estimates** — projected values carry an "estimate" label and the muted/yellow treatment, plus a plain-English assumptions note. Never present a projection as certain.
- Every tax term that could confuse a layman needs a `JargonTip`.
- No backend; pure functions stay pure (no I/O in `projection.ts`).
- Run `npm run test` after any change under `src/lib/` or `src/components/ui/`. All tests must pass before committing (currently 116).

---

## File structure

```
src/
├── lib/
│   ├── projection.ts            NEW — pure projectTaxYear() engine
│   └── projection.test.ts       NEW — unit tests (the numeric heart)
├── components/
│   └── ui/
│       ├── PeriodToggle.tsx      NEW — This month / YTD / Projected segmented control
│       └── PeriodToggle.test.tsx NEW
└── screens/
    ├── DashboardScreen.tsx       MODIFY — projected panel + shortfall + period toggle
    └── IncomeScreen.tsx          MODIFY — period toggle + projected column; seed ForecastSlider
```

---

## Task 1: Projection engine (`projection.ts`)

**Files:**
- Create: `src/lib/projection.ts`
- Test: `src/lib/projection.test.ts`

**Interfaces:**
- Consumes: `incomeTax`, `employeeNI`, `effectivePersonalAllowance`, `parseTaxCode`, `marginalBand`, `dividendTaxStacked`, `savingsTaxStacked`, `type Band` from `./taxCalc`; `TaxRates` from `./taxRates`; `summariseTaxYear` from `./incomeSummary`; `getTaxPeriod` from `./taxYears`; types `TaxYear`, `FutureIncomeEvent`.
- Produces: `projectTaxYear(input: ProjectionInput): TaxProjection`, plus the `ProjectionInput` and `TaxProjection` interfaces.

- [ ] **Step 1: Write the failing tests** — `src/lib/projection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { projectTaxYear, type ProjectionInput } from './projection'
import { CURRENT_RATES } from './taxRates'
import type { TaxYear, Payslip, FutureIncomeEvent } from '../types'

function payslip(over: Partial<Payslip> = {}): Payslip {
  return {
    id: 'p1', taxPeriod: 6, taxYear: '2025-26', date: '2025-09-30',
    basicSalary: 5000, carAllowance: 0, otherPayments: [], taxPaid: 800, employeeNI: 300,
    salarySacrifice: [], esppContribution: 0, employerMatch: 0,
    ytdGross: 30000, ytdTaxPaid: 4800, ytdEmployeeNI: 1800,
    taxCode: '1257L', niNumber: 'AB123456C', employerName: 'SAP UK Ltd', rawExtracted: {},
    ...over,
  }
}

function taxYear(payslips: Payslip[], over: Partial<TaxYear> = {}): TaxYear {
  return {
    key: '2025-26', startDate: '2025-04-06', endDate: '2026-04-05',
    employment: payslips.length ? [{ id: 'e1', employerName: 'SAP UK Ltd', payslips }] : [],
    dividends: [], savingsInterest: [], benefitsInKind: [], ...over,
  }
}

const baseInput = (over: Partial<ProjectionInput> = {}): ProjectionInput => ({
  taxYear: taxYear([payslip()]), events: [], baseAnnualSalary: null, taxCode: '1257L',
  today: new Date('2025-09-30'), rates: CURRENT_RATES, ...over,
})

describe('projectTaxYear', () => {
  it('is unavailable when there is no payslip', () => {
    const p = projectTaxYear(baseInput({ taxYear: taxYear([]) }))
    expect(p.available).toBe(false)
    expect(p.projectedGross).toBe(0)
  })

  it('annualises the YTD run-rate when no base salary is stated', () => {
    // ytdGross 30000 at period 6 → monthly 5000 → 12 months = 60000
    const p = projectTaxYear(baseInput())
    expect(p.available).toBe(true)
    expect(p.usedStatedSalary).toBe(false)
    expect(p.projectedGross).toBeCloseTo(60000, 2)
  })

  it('prefers a stated base salary over the run-rate for future months', () => {
    // ytdGross 30000 (periods 1-6), stated 72000 → future 6 months at 6000 = 36000 → 66000
    const p = projectTaxYear(baseInput({ baseAnnualSalary: 72000 }))
    expect(p.usedStatedSalary).toBe(true)
    expect(p.projectedGross).toBeCloseTo(66000, 2)
  })

  it('adds a one-off bonus to the projected gross', () => {
    const bonus: FutureIncomeEvent = { id: 'b', type: 'bonus', label: 'Bonus', amount: 8000, effectiveDate: '2026-03-31', taxYear: '2025-26', subjectToNI: true }
    const withB = projectTaxYear(baseInput({ events: [bonus] }))
    const without = projectTaxYear(baseInput())
    expect(withB.projectedGross - without.projectedGross).toBeCloseTo(8000, 2)
  })

  it('steps the run-rate up from a pay-rise effective date', () => {
    // pay-rise to 96000/yr (8000/mo) effective period 9 (Dec) → periods 9-12 at 8000
    const raise: FutureIncomeEvent = { id: 'r', type: 'pay-rise', label: 'Raise', amount: 96000, effectiveDate: '2025-12-01', taxYear: '2025-26', subjectToNI: true }
    const withR = projectTaxYear(baseInput({ events: [raise] }))
    const without = projectTaxYear(baseInput())
    expect(withR.projectedGross).toBeGreaterThan(without.projectedGross)
  })

  it('ignores events from a different tax year', () => {
    const other: FutureIncomeEvent = { id: 'o', type: 'bonus', label: 'Old', amount: 5000, effectiveDate: '2024-12-31', taxYear: '2024-25', subjectToNI: true }
    expect(projectTaxYear(baseInput({ events: [other] })).projectedGross).toBeCloseTo(60000, 2)
  })

  it('reports a shortfall to set aside when there is untaxed dividend income', () => {
    const p = projectTaxYear(baseInput({ taxYear: taxYear([payslip()], { dividends: [{ id: 'd', description: 'Acme', amount: 6000, date: '2025-08-01', taxYear: '2025-26' }] }) }))
    // dividends are not withheld by PAYE → a positive set-aside shortfall
    expect(p.shortfall).toBeGreaterThan(0)
  })

  it('produces a positive projected tax due for a normal earner', () => {
    const p = projectTaxYear(baseInput())
    expect(p.projectedTaxDue).toBeGreaterThan(0)
    expect(['basic', 'higher', 'additional']).toContain(p.band)
  })

  it('carries plain-English assumptions', () => {
    expect(projectTaxYear(baseInput()).assumptions.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/projection.test.ts`
Expected: FAIL — module `./projection` not found.

- [ ] **Step 3: Write the implementation** — `src/lib/projection.ts`:

```ts
import type { TaxYear, FutureIncomeEvent } from '../types'
import type { TaxRates } from './taxRates'
import {
  incomeTax, employeeNI, effectivePersonalAllowance, parseTaxCode, marginalBand,
  dividendTaxStacked, savingsTaxStacked, type Band,
} from './taxCalc'
import { summariseTaxYear } from './incomeSummary'
import { getTaxPeriod } from './taxYears'

export interface ProjectionInput {
  taxYear: TaxYear
  events: FutureIncomeEvent[]
  baseAnnualSalary: number | null
  taxCode: string | null
  today: Date
  rates: TaxRates
}

export interface TaxProjection {
  available: boolean
  projectedGross: number     // projected annual employment gross (incl. one-offs)
  projectedTaxDue: number    // total income tax + NI + dividend + savings tax
  projectedPAYE: number      // estimated PAYE withheld over the year
  shortfall: number          // projectedTaxDue - projectedPAYE (>0 = set aside)
  band: Band
  monthsElapsed: number
  usedStatedSalary: boolean
  assumptions: string[]
}

function latestPayslip(ty: TaxYear) {
  const all = ty.employment.flatMap(e => e.payslips)
  if (all.length === 0) return null
  return all.reduce((a, p) => (p.taxPeriod > a.taxPeriod ? p : a), all[0])
}

export function projectTaxYear(input: ProjectionInput): TaxProjection {
  const { taxYear, events, baseAnnualSalary, taxCode, rates } = input
  const latest = latestPayslip(taxYear)

  if (!latest) {
    return {
      available: false, projectedGross: 0, projectedTaxDue: 0, projectedPAYE: 0,
      shortfall: 0, band: 'basic', monthsElapsed: 0, usedStatedSalary: false,
      assumptions: ['No payslip yet — add one to project your year-end position.'],
    }
  }

  const m = latest.taxPeriod
  const ytdGross = latest.ytdGross
  const usedStatedSalary = baseAnnualSalary != null
  const monthlyForFuture = usedStatedSalary ? (baseAnnualSalary as number) / 12 : ytdGross / m

  const yearEvents = events.filter(e => e.taxYear === taxYear.key)
  const payRises = yearEvents.filter(e => e.type === 'pay-rise')
  const oneOffs = yearEvents.filter(e => e.type === 'bonus' || e.type === 'rsu-vest')

  // Future employment run-rate, stepping at each pay-rise effective period.
  let futureGross = 0
  for (let p = m + 1; p <= 12; p++) {
    const active = payRises
      .filter(e => getTaxPeriod(new Date(e.effectiveDate)) <= p)
      .sort((a, b) => getTaxPeriod(new Date(a.effectiveDate)) - getTaxPeriod(new Date(b.effectiveDate)))
    futureGross += active.length ? active[active.length - 1].amount / 12 : monthlyForFuture
  }

  const oneOffTotal = oneOffs.reduce((s, e) => s + e.amount, 0)
  const oneOffNoNI = oneOffs.filter(e => e.subjectToNI === false).reduce((s, e) => s + e.amount, 0)
  const projectedGross = ytdGross + futureGross + oneOffTotal
  const niBase = projectedGross - oneOffNoNI

  const summary = summariseTaxYear(taxYear)
  const { dividendIncome: dividends, savingsIncome: savings, benefitsInKind: benefits } = summary

  const totalForTaper = projectedGross + benefits + dividends + savings
  const codeAllowance = taxCode ? parseTaxCode(taxCode).allowance : null
  const allowance = codeAllowance ?? effectivePersonalAllowance(totalForTaper, rates)

  const employmentForTax = projectedGross + benefits
  const incomeTaxDue = incomeTax(employmentForTax, allowance, rates)
  const niDue = employeeNI(niBase, rates)
  const savingsTaxDue = savingsTaxStacked(savings, employmentForTax, allowance, rates)
  const dividendTaxDue = dividendTaxStacked(dividends, employmentForTax + savings, allowance, rates)
  const projectedTaxDue = incomeTaxDue + niDue + savingsTaxDue + dividendTaxDue

  const band: Band = marginalBand(totalForTaper, rates)

  // Estimated PAYE withheld: annualise the YTD run-rate, then add PAYE on the
  // amounts added on top of that plain run-rate (pay-rise deltas + one-offs) at
  // the projected marginal rate. Dividend/savings tax is NOT withheld by PAYE,
  // so it falls through into the shortfall the user must set aside.
  const runRatePAYE = ((latest.ytdTaxPaid + latest.ytdEmployeeNI) / m) * 12
  const plainFuture = monthlyForFuture * (12 - m)
  const additions = (projectedGross - ytdGross) - plainFuture // pay-rise deltas + one-offs
  const incomeMarginal = band === 'basic' ? rates.basicRate : band === 'higher' ? rates.higherRate : rates.additionalRate
  const niMarginal = niBase > rates.niUpperEarningsLimit ? rates.niUpperRate : rates.niMainRate
  const niableAdditions = Math.max(0, additions - oneOffNoNI)
  const payeOnAdditions = additions * incomeMarginal + niableAdditions * niMarginal
  const projectedPAYE = runRatePAYE + payeOnAdditions

  const shortfall = projectedTaxDue - projectedPAYE

  const assumptions = [
    usedStatedSalary
      ? 'Future months use your stated base salary.'
      : 'Future months assume your latest payslip is a typical month.',
    'PAYE withholding is estimated from your payslips so far. Tax on dividends and savings is not taken by PAYE — that is the shortfall to set aside.',
  ]

  return {
    available: true, projectedGross, projectedTaxDue, projectedPAYE, shortfall,
    band, monthsElapsed: m, usedStatedSalary, assumptions,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/projection.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: all pass (116 + 9).

- [ ] **Step 6: Commit**

```bash
git add src/lib/projection.ts src/lib/projection.test.ts
git commit -m "feat: projectTaxYear engine — full-year projection with future income events"
```

---

## Task 2: `PeriodToggle` segmented control

**Files:**
- Create: `src/components/ui/PeriodToggle.tsx`
- Test: `src/components/ui/PeriodToggle.test.tsx`

**Interfaces:**
- Produces: `type Period = 'month' | 'ytd' | 'projected'`; `PeriodToggle` component with props `{ value: Period; onChange: (p: Period) => void }`.

- [ ] **Step 1: Write the failing test** — `src/components/ui/PeriodToggle.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { PeriodToggle } from './PeriodToggle'

describe('PeriodToggle', () => {
  it('renders the three period options and marks the active one', () => {
    render(<PeriodToggle value="ytd" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /this month/i })).toBeInTheDocument()
    const ytd = screen.getByRole('button', { name: /year to date/i })
    expect(ytd).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /projected/i })).toBeInTheDocument()
  })

  it('calls onChange with the selected period', () => {
    const onChange = vi.fn()
    render(<PeriodToggle value="ytd" onChange={onChange} />)
    screen.getByRole('button', { name: /projected/i }).click()
    expect(onChange).toHaveBeenCalledWith('projected')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/PeriodToggle.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component** — `src/components/ui/PeriodToggle.tsx`:

```tsx
export type Period = 'month' | 'ytd' | 'projected'

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'projected', label: 'Projected' },
]

interface Props {
  value: Period
  onChange: (p: Period) => void
}

export function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-white/[0.06]">
      {OPTIONS.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-accent text-bg' : 'text-text-2 hover:text-text-1'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/PeriodToggle.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PeriodToggle.tsx src/components/ui/PeriodToggle.test.tsx
git commit -m "feat: PeriodToggle segmented control (This month / YTD / Projected)"
```

---

## Task 3: Dashboard — projected panel + shortfall + period toggle

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `projectTaxYear` (Task 1), `PeriodToggle`/`Period` (Task 2), `useFutureEvents` (Plan 7), `useProfile` (for `profile.taxCode` and `profile.baseAnnualSalary`).

Context: `DashboardScreen` already reads `useTaxYear`, `useProfile`, computes a YTD summary via `summariseTaxYear`, and renders `StatCard`s. It already early-returns `<FirstPayslipPrompt />` when there are no payslips (Plan 7). This task ADDS a projected view; it does not remove the existing YTD stats.

- [ ] **Step 1: Add the projection + toggle state.** Near the top of the component (after the existing hooks), add:

```tsx
import { useState } from 'react'
import { PeriodToggle, type Period } from '../components/ui/PeriodToggle'
import { projectTaxYear } from '../lib/projection'
import { useFutureEvents } from '../hooks/useFutureEvents'
// inside the component, after existing useTaxYear/useProfile:
const { events } = useFutureEvents(profileId)
const [period, setPeriod] = useState<Period>('ytd')
```

- [ ] **Step 2: Compute the projection** after the `hasAnyPayslip` guard and existing `s`/allowance computation:

```tsx
const projection = projectTaxYear({
  taxYear,
  events,
  baseAnnualSalary: profile?.baseAnnualSalary ?? null,
  taxCode: s.taxCode,
  today: new Date(),
  rates: R,
})
```

- [ ] **Step 3: Render the toggle + a projected panel.** Add the `PeriodToggle` in the header row, and below the existing YTD stat cards add a projected section shown when `period === 'projected'` (or always, beside YTD — implementer's layout choice, but the projected block MUST use the yellow/estimate treatment and include the shortfall and a JargonTip-explained assumptions note). Minimum required elements:

```tsx
{projection.available && period === 'projected' && (
  <section className="mt-6">
    <div className="flex items-center gap-2 mb-3">
      <h2 className="font-serif text-base">Projected year-end</h2>
      <span className="font-mono text-[10px] uppercase tracking-wide text-yellow bg-yellow/10 px-2 py-0.5 rounded">Estimate</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatCard label="Projected income" value={`£${Math.round(projection.projectedGross).toLocaleString('en-GB')}`} variant="default" />
      <StatCard label="Projected tax + NI" value={`£${Math.round(projection.projectedTaxDue).toLocaleString('en-GB')}`} variant="warning" />
      <StatCard
        label={projection.shortfall >= 0 ? 'Set aside for April' : 'Likely refund'}
        value={`£${Math.round(Math.abs(projection.shortfall)).toLocaleString('en-GB')}`}
        variant={projection.shortfall >= 0 ? 'danger' : 'positive'}
      />
    </div>
    <ul className="mt-3 space-y-1">
      {projection.assumptions.map((a, i) => (
        <li key={i} className="text-text-2 text-xs">• {a}</li>
      ))}
    </ul>
  </section>
)}
```

Note: confirm the exact `StatCard` `variant` prop values by reading `src/components/ui/StatCard.tsx` (use its existing variants; map estimate→warning, shortfall→danger, refund→positive). The "This month" period may reuse the latest payslip's monthly figures; if a clean monthly split isn't available, the toggle may show YTD for 'month' with a note — do not fabricate a monthly breakdown.

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && npm run test`
Expected: clean build, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/DashboardScreen.tsx
git commit -m "feat: Dashboard projected year-end panel + shortfall + period toggle (#2)"
```

---

## Task 4: Income — period toggle + projected; seed ForecastSlider

**Files:**
- Modify: `src/screens/IncomeScreen.tsx`

**Interfaces:**
- Consumes: `projectTaxYear` (Task 1), `PeriodToggle`/`Period` (Task 2), `useFutureEvents`, `useProfile`.

Context: `IncomeScreen` reads `useTaxYear`, computes `s = summariseTaxYear(taxYear)`, renders income rows + a `ForecastSlider baseIncome={s.employmentIncome}`, and early-returns `<FirstPayslipPrompt />` when no payslips (Plan 7). It currently does NOT read `useProfile`.

- [ ] **Step 1: Add profile + future events + projection + toggle.** Add imports and, in the component:

```tsx
import { useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { projectTaxYear } from '../lib/projection'
import { PeriodToggle, type Period } from '../components/ui/PeriodToggle'
import { CURRENT_RATES as R } from '../lib/taxRates'
// in component:
const { profile } = useProfile(profileId)
const { events } = useFutureEvents(profileId)
const [period, setPeriod] = useState<Period>('ytd')
// after the hasAnyPayslip guard + `s`:
const projection = projectTaxYear({ taxYear, events, baseAnnualSalary: profile?.baseAnnualSalary ?? null, taxCode: s.taxCode, today: new Date(), rates: R })
```

- [ ] **Step 2: Add the toggle to the header** and, when `period === 'projected'` and `projection.available`, show the projected employment income (`projection.projectedGross`) with the yellow "Estimate" treatment beside/instead of the YTD taxable total. Keep the confirmed YTD total labelled "confirmed".

- [ ] **Step 3: Seed the ForecastSlider from the projected base.** Change:

```tsx
<ForecastSlider baseIncome={projection.available ? projection.projectedGross : s.employmentIncome} />
```

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && npm run test`
Expected: clean build, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/IncomeScreen.tsx
git commit -m "feat: Income projected view + period toggle; seed forecaster from projection (#2)"
```

---

## Task 5: Deploy to staging + verify

**Files:** none.

- [ ] **Step 1: Push**

```bash
git push origin dev
```

- [ ] **Step 2: Confirm staging deploy is green**

Run: `gh run watch $(gh run list --branch dev --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`

- [ ] **Step 3: Comment on issue #2**

```bash
gh issue comment 2 --body "Projection engine + YTD/Projected presentation shipped to dev/staging. Full-year projection with bonus / pay-rise / RSU-vest events, projected tax + NI, and a set-aside shortfall, shown as a clearly-labelled estimate beside confirmed YTD with a This month / YTD / Projected toggle. Ready for phone re-test."
```

Leave issue #2 open until the user confirms on their phone.

---

## Self-review notes

- **Spec coverage:** projection engine (base salary preference, run-rate, future events, shortfall) → Task 1; This month / YTD / Projected toggle → Task 2; confirmed-YTD-beside-projected presentation + shortfall + estimate treatment → Tasks 3/4; ForecastSlider seeded from projection → Task 4.
- **Estimate honesty:** projected blocks carry the "Estimate" label, yellow treatment, and the assumptions list — enforced in Tasks 3/4 and the Global Constraints.
- **Type consistency:** `projectTaxYear(input)` / `ProjectionInput` / `TaxProjection` used consistently; `Period` type shared from `PeriodToggle`.
- **Deferred:** editing future events / base salary lives in the Account screen (Plan 9); this plan reads them (via `useFutureEvents` + `profile.baseAnnualSalary`) but does not add editing UI.
```
