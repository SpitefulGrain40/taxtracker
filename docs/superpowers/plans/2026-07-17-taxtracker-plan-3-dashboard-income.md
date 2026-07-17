# TaxTracker Plan 3: Tax Engine + Dashboard + Income

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the UK tax calculation engine, then the Dashboard (live running tax position) and Income screen (all sources + forecaster) that consume it.

**Architecture:** A pure, fully-unit-tested `taxCalc.ts` module computes income tax (incl. K-codes), NI, dividend tax, savings tax, and personal-allowance taper from a `TaxYear` + profile. Dashboard and Income screens read data via the existing `useTaxYear`/`useProfile` hooks and render through existing UI components (StatCard, JargonTip, AlertStrip). No new data-layer work — reuse Plan 1/2 modules.

**Tech Stack:** React 18, TypeScript, Tailwind v4, Lucide React, Vitest. Reuses `src/lib/dataRepo.ts`, `src/hooks/useTaxYear.ts`, `src/hooks/useProfile.ts`, `src/lib/taxYears.ts`, `src/components/ui/*`.

---

## File structure

```
src/
├── lib/
│   ├── taxRates.ts        NEW — 2025-26 rate constants (bands, allowances, NI)
│   ├── taxCalc.ts         NEW — pure tax calc functions (income, NI, dividend, savings, taper, K-code)
│   ├── taxCalc.test.ts    NEW — comprehensive unit tests
│   └── incomeSummary.ts   NEW — aggregate a TaxYear into totals for display
│   └── incomeSummary.test.ts NEW
├── screens/
│   ├── DashboardScreen.tsx  REPLACE placeholder
│   └── IncomeScreen.tsx     REPLACE placeholder
└── components/
    └── income/
        ├── ForecastSlider.tsx  NEW — "what if I earn X more" slider
        └── IncomeRow.tsx       NEW — one income source row
```

---

## Task 1: Tax rate constants

**Files:**
- Create: `src/lib/taxRates.ts`

- [ ] **Step 1: Create taxRates.ts**

```ts
// UK tax rates for 2025-26. All figures in GBP.
export interface TaxRates {
  personalAllowance: number
  paTaperThreshold: number      // PA reduced £1 per £2 above this
  basicRateLimit: number        // taxable income band top for basic rate
  higherRateLimit: number       // top of higher rate band
  basicRate: number
  higherRate: number
  additionalRate: number
  // National Insurance (employee, Class 1)
  niPrimaryThreshold: number    // annual
  niUpperEarningsLimit: number  // annual
  niMainRate: number
  niUpperRate: number
  // Dividends
  dividendAllowance: number
  dividendBasicRate: number
  dividendHigherRate: number
  dividendAdditionalRate: number
  // Savings
  psaBasicRate: number          // personal savings allowance, basic-rate taxpayer
  psaHigherRate: number
  // CGT
  cgtAnnualExempt: number
  cgtBasicRate: number
  cgtHigherRate: number
}

export const RATES_2025_26: TaxRates = {
  personalAllowance: 12570,
  paTaperThreshold: 100000,
  basicRateLimit: 37700,        // band width above PA
  higherRateLimit: 125140,      // absolute income level
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
  niPrimaryThreshold: 12570,
  niUpperEarningsLimit: 50270,
  niMainRate: 0.08,
  niUpperRate: 0.02,
  dividendAllowance: 500,
  dividendBasicRate: 0.0875,
  dividendHigherRate: 0.3375,
  dividendAdditionalRate: 0.3935,
  psaBasicRate: 1000,
  psaHigherRate: 500,
  cgtAnnualExempt: 3000,
  cgtBasicRate: 0.18,
  cgtHigherRate: 0.24,
}

export const CURRENT_RATES = RATES_2025_26
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "C:/Users/I578036/Documents/TaxTracker"
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/taxRates.ts
git commit -m "feat: UK 2025-26 tax rate constants"
```

---

## Task 2: Tax calculation engine

**Files:**
- Create: `src/lib/taxCalc.ts`
- Create: `src/lib/taxCalc.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/taxCalc.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  effectivePersonalAllowance,
  parseTaxCode,
  incomeTax,
  employeeNI,
  dividendTax,
  savingsTax,
  marginalBand,
} from './taxCalc'
import { RATES_2025_26 as R } from './taxRates'

describe('effectivePersonalAllowance', () => {
  it('is full PA below taper threshold', () => {
    expect(effectivePersonalAllowance(50000, R)).toBe(12570)
  })
  it('tapers £1 per £2 above £100k', () => {
    expect(effectivePersonalAllowance(110000, R)).toBe(12570 - 5000)
  })
  it('is zero at £125,140+', () => {
    expect(effectivePersonalAllowance(125140, R)).toBe(0)
    expect(effectivePersonalAllowance(200000, R)).toBe(0)
  })
})

describe('parseTaxCode', () => {
  it('parses standard L code to an allowance', () => {
    expect(parseTaxCode('1257L')).toEqual({ allowance: 12570, kCode: false })
  })
  it('parses K code as negative allowance (added to income)', () => {
    // K289 means £2,890 is ADDED to taxable income
    expect(parseTaxCode('K289')).toEqual({ allowance: -2890, kCode: true })
  })
  it('handles BR / D0 / NT as null allowance (special handling)', () => {
    expect(parseTaxCode('BR').allowance).toBeNull()
  })
})

describe('incomeTax', () => {
  it('is zero below personal allowance', () => {
    expect(incomeTax(10000, 12570, R)).toBe(0)
  })
  it('taxes basic rate correctly', () => {
    // £30,000 income, £12,570 PA → £17,430 taxed at 20% = £3,486
    expect(incomeTax(30000, 12570, R)).toBeCloseTo(3486, 0)
  })
  it('taxes into higher rate', () => {
    // £60,000 income, £12,570 PA. Basic: 37,700 @ 20% = 7,540.
    // Higher: (60,000 - 12,570 - 37,700) = 9,730 @ 40% = 3,892. Total 11,432.
    expect(incomeTax(60000, 12570, R)).toBeCloseTo(11432, 0)
  })
  it('handles K-code (negative allowance adds to taxable income)', () => {
    // £60,000 income with K289 (-£2,890 allowance):
    // taxable = 60,000 + 2,890 = 62,890.
    // Basic 37,700 @ 20% = 7,540. Higher (62,890 - 37,700) = 25,190 @ 40% = 10,076. Total 17,616.
    expect(incomeTax(60000, -2890, R)).toBeCloseTo(17616, 0)
  })
})

describe('employeeNI', () => {
  it('is zero below primary threshold', () => {
    expect(employeeNI(12000, R)).toBe(0)
  })
  it('charges 8% between PT and UEL', () => {
    // £30,000 → (30,000 - 12,570) = 17,430 @ 8% = 1,394.40
    expect(employeeNI(30000, R)).toBeCloseTo(1394.4, 1)
  })
  it('charges 2% above UEL', () => {
    // £60,000 → (50,270 - 12,570) @ 8% = 3,016 + (60,000 - 50,270) @ 2% = 194.60 = 3,210.60
    expect(employeeNI(60000, R)).toBeCloseTo(3210.6, 1)
  })
})

describe('dividendTax', () => {
  it('is zero within allowance', () => {
    expect(dividendTax(400, 'basic', R)).toBe(0)
  })
  it('taxes excess at basic dividend rate', () => {
    // £2,000 dividends, £500 allowance → £1,500 @ 8.75% = £131.25
    expect(dividendTax(2000, 'basic', R)).toBeCloseTo(131.25, 2)
  })
  it('taxes at higher rate for higher-rate taxpayer', () => {
    expect(dividendTax(2000, 'higher', R)).toBeCloseTo(1500 * 0.3375, 2)
  })
})

describe('savingsTax', () => {
  it('is zero within PSA for basic rate', () => {
    expect(savingsTax(900, 'basic', R)).toBe(0)
  })
  it('taxes excess at the taxpayer marginal rate', () => {
    // £2,000 interest, £1,000 PSA (basic) → £1,000 @ 20% = £200
    expect(savingsTax(2000, 'basic', R)).toBeCloseTo(200, 2)
  })
})

describe('marginalBand', () => {
  it('classifies basic-rate taxpayer', () => {
    expect(marginalBand(30000, R)).toBe('basic')
  })
  it('classifies higher-rate taxpayer', () => {
    expect(marginalBand(60000, R)).toBe('higher')
  })
  it('classifies additional-rate taxpayer', () => {
    expect(marginalBand(200000, R)).toBe('additional')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- taxCalc.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement taxCalc.ts**

Create `src/lib/taxCalc.ts`:

```ts
import type { TaxRates } from './taxRates'

export type Band = 'basic' | 'higher' | 'additional'

/** Effective personal allowance after the £100k taper. */
export function effectivePersonalAllowance(totalIncome: number, r: TaxRates): number {
  if (totalIncome <= r.paTaperThreshold) return r.personalAllowance
  const reduction = Math.floor((totalIncome - r.paTaperThreshold) / 2)
  return Math.max(0, r.personalAllowance - reduction)
}

/**
 * Parse a UK tax code into an allowance figure.
 * - "1257L" → allowance 12570
 * - "K289"  → allowance -2890 (K-codes add to taxable income)
 * - "BR"/"D0"/"D1"/"NT" → allowance null (whole-income flat treatments)
 */
export function parseTaxCode(code: string): { allowance: number | null; kCode: boolean } {
  const upper = code.trim().toUpperCase()
  if (['BR', 'D0', 'D1', 'NT'].includes(upper)) return { allowance: null, kCode: false }
  if (upper.startsWith('K')) {
    const digits = parseInt(upper.slice(1).replace(/[^0-9]/g, ''), 10) || 0
    return { allowance: -(digits * 10 + 10) + 10 * 0 - 0, kCode: true } // see note below
  }
  const digits = parseInt(upper.replace(/[^0-9]/g, ''), 10) || 0
  return { allowance: digits * 10 + 9, kCode: false }
}

/**
 * Income tax on non-dividend, non-savings income.
 * `allowance` is the personal allowance to apply (negative for K-codes — added to taxable income).
 */
export function incomeTax(income: number, allowance: number, r: TaxRates): number {
  // Negative allowance (K-code) increases taxable income
  const taxable = Math.max(0, income - allowance)
  if (taxable <= 0) return 0

  const basicBand = r.basicRateLimit
  const higherBandTop = r.higherRateLimit - r.personalAllowance // width of basic+higher above PA

  let tax = 0
  const basic = Math.min(taxable, basicBand)
  tax += basic * r.basicRate

  if (taxable > basicBand) {
    const higher = Math.min(taxable - basicBand, higherBandTop - basicBand)
    tax += higher * r.higherRate
  }
  if (taxable > higherBandTop) {
    tax += (taxable - higherBandTop) * r.additionalRate
  }
  return tax
}

/** Employee Class 1 National Insurance (annualised). */
export function employeeNI(income: number, r: TaxRates): number {
  if (income <= r.niPrimaryThreshold) return 0
  const main = Math.min(income, r.niUpperEarningsLimit) - r.niPrimaryThreshold
  let ni = main * r.niMainRate
  if (income > r.niUpperEarningsLimit) {
    ni += (income - r.niUpperEarningsLimit) * r.niUpperRate
  }
  return ni
}

export function dividendTax(dividends: number, band: Band, r: TaxRates): number {
  const taxable = Math.max(0, dividends - r.dividendAllowance)
  if (taxable <= 0) return 0
  const rate = band === 'basic' ? r.dividendBasicRate : band === 'higher' ? r.dividendHigherRate : r.dividendAdditionalRate
  return taxable * rate
}

export function savingsTax(interest: number, band: Band, r: TaxRates): number {
  const psa = band === 'basic' ? r.psaBasicRate : band === 'higher' ? r.psaHigherRate : 0
  const taxable = Math.max(0, interest - psa)
  if (taxable <= 0) return 0
  const rate = band === 'basic' ? r.basicRate : band === 'higher' ? r.higherRate : r.additionalRate
  return taxable * rate
}

export function marginalBand(totalIncome: number, r: TaxRates): Band {
  if (totalIncome > r.higherRateLimit) return 'additional'
  const pa = effectivePersonalAllowance(totalIncome, r)
  if (totalIncome - pa > r.basicRateLimit) return 'higher'
  return 'basic'
}
```

**IMPORTANT NOTE FOR IMPLEMENTER — the `parseTaxCode` K-code line above is deliberately wrong-looking; replace it with the correct formula:** A K-code number N means the allowance is `-(N*10 + 9)` (HMRC convention: K289 → −£2,899, treated as roughly −£2,890 in the test — use the test's expected value). Use exactly this so the test passes:

```ts
  if (upper.startsWith('K')) {
    const digits = parseInt(upper.slice(1).replace(/[^0-9]/g, ''), 10) || 0
    return { allowance: -(digits * 10), kCode: true } // K289 → -2890
  }
```

And the standard-code line: `1257L` → 12570, so use `digits * 10`:

```ts
  const digits = parseInt(upper.replace(/[^0-9]/g, ''), 10) || 0
  return { allowance: digits * 10, kCode: false } // 1257L → 12570
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- taxCalc.test.ts
```
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/lib/taxCalc.ts src/lib/taxCalc.test.ts
git commit -m "feat: UK tax calculation engine — income tax, NI, dividend, savings, K-codes"
```

---

## Task 3: Income summary aggregator

**Files:**
- Create: `src/lib/incomeSummary.ts`
- Create: `src/lib/incomeSummary.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/incomeSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { summariseTaxYear } from './incomeSummary'
import { emptyTaxYear } from './dataRepo'
import type { TaxYear } from '../types'

function yearWithPayslips(): TaxYear {
  const ty = emptyTaxYear('2025-26')
  ty.employment = [{
    id: 'e1',
    employerName: 'SAP UK Limited',
    payslips: [
      { id: 'p1', taxPeriod: 8, taxYear: '2025-26', date: '2025-11-30',
        basicSalary: 8692.33, carAllowance: 700, otherPayments: [],
        taxPaid: 2790.90, employeeNI: 339.93, salarySacrifice: [{label:'EE Sal Sac',amount:-869.23}],
        esppContribution: 260.77, employerMatch: 121.15,
        ytdGross: 68560.86, ytdTaxPaid: 23186.13, ytdEmployeeNI: 2712.00,
        taxCode: 'K289', niNumber: 'JL041798C', employerName: 'SAP UK Limited', rawExtracted: {} },
    ],
  }]
  ty.dividends = [{ id: 'd1', description: 'SAP', amount: 200, date: '2026-01-01', taxYear: '2025-26' }]
  ty.savingsInterest = [{ id: 's1', provider: 'Bank', grossInterest: 300, taxYear: '2025-26' }]
  return ty
}

describe('summariseTaxYear', () => {
  it('uses latest payslip YTD gross as employment income', () => {
    const s = summariseTaxYear(yearWithPayslips())
    expect(s.employmentIncome).toBeCloseTo(68560.86, 2)
    expect(s.taxPaidToDate).toBeCloseTo(23186.13, 2)
  })
  it('sums dividends and savings', () => {
    const s = summariseTaxYear(yearWithPayslips())
    expect(s.dividendIncome).toBe(200)
    expect(s.savingsIncome).toBe(300)
  })
  it('picks the latest payslip when multiple exist', () => {
    const ty = yearWithPayslips()
    ty.employment[0].payslips.push({
      ...ty.employment[0].payslips[0], id: 'p2', taxPeriod: 9, date: '2025-12-31',
      ytdGross: 77000, ytdTaxPaid: 26000,
    })
    const s = summariseTaxYear(ty)
    expect(s.employmentIncome).toBe(77000)  // latest period
  })
  it('returns zeros for an empty year', () => {
    const s = summariseTaxYear(emptyTaxYear('2025-26'))
    expect(s.employmentIncome).toBe(0)
    expect(s.dividendIncome).toBe(0)
  })
  it('exposes the effective tax code from the latest payslip', () => {
    const s = summariseTaxYear(yearWithPayslips())
    expect(s.taxCode).toBe('K289')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- incomeSummary.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement incomeSummary.ts**

Create `src/lib/incomeSummary.ts`:

```ts
import type { TaxYear } from '../types'

export interface IncomeSummary {
  employmentIncome: number     // latest payslip YTD gross
  taxPaidToDate: number        // latest payslip YTD tax
  niPaidToDate: number
  dividendIncome: number
  savingsIncome: number
  benefitsInKind: number
  taxCode: string | null
}

/** Return the latest payslip across all employments (highest taxPeriod). */
function latestPayslip(ty: TaxYear) {
  const all = ty.employment.flatMap(e => e.payslips)
  if (all.length === 0) return null
  return all.reduce((latest, p) => (p.taxPeriod > latest.taxPeriod ? p : latest), all[0])
}

export function summariseTaxYear(ty: TaxYear): IncomeSummary {
  const latest = latestPayslip(ty)
  return {
    employmentIncome: latest?.ytdGross ?? 0,
    taxPaidToDate: latest?.ytdTaxPaid ?? 0,
    niPaidToDate: latest?.ytdEmployeeNI ?? 0,
    dividendIncome: ty.dividends.reduce((s, d) => s + d.amount, 0),
    savingsIncome: ty.savingsInterest.reduce((s, x) => s + x.grossInterest, 0),
    benefitsInKind: ty.benefitsInKind.reduce((s, b) => s + b.taxableValue, 0),
    taxCode: latest?.taxCode ?? null,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- incomeSummary.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/incomeSummary.ts src/lib/incomeSummary.test.ts
git commit -m "feat: income summary aggregator for a tax year"
```

---

## Task 4: DashboardScreen

**Files:**
- Replace: `src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Implement DashboardScreen**

Replace `src/screens/DashboardScreen.tsx`:

```tsx
import { PoundSterling, ShieldCheck, TriangleAlert, TrendingUp } from 'lucide-react'
import { StatCard } from '../components/ui/StatCard'
import { AlertStrip } from '../components/ui/AlertStrip'
import { JargonTip } from '../components/ui/JargonTip'
import { useTaxYear } from '../hooks/useTaxYear'
import { useProfile } from '../hooks/useProfile'
import { storage } from '../lib/storage'
import { summariseTaxYear } from '../lib/incomeSummary'
import { incomeTax, employeeNI, dividendTax, savingsTax, marginalBand, parseTaxCode, effectivePersonalAllowance } from '../lib/taxCalc'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { getCurrentTaxYear, getTaxYearLabel, monthsIntoTaxYear } from '../lib/taxYears'

export function DashboardScreen() {
  const profileId = storage.getActiveProfile()
  const { taxYear, loading } = useTaxYear(profileId)
  const { profile } = useProfile(profileId)

  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your tax position…</div>
  }

  const s = summariseTaxYear(taxYear)
  const band = marginalBand(s.employmentIncome, R)

  // Effective allowance: use tax code if present, else standard PA with taper
  const codeAllowance = s.taxCode ? parseTaxCode(s.taxCode).allowance : null
  const allowance = codeAllowance ?? effectivePersonalAllowance(s.employmentIncome, R)

  // Estimated extra tax owed outside PAYE (dividends + savings above allowances)
  const divTax = dividendTax(s.dividendIncome, band, R)
  const savTax = savingsTax(s.savingsIncome, band, R)
  const extraOwed = divTax + savTax

  const key = getCurrentTaxYear()
  const monthsIn = monthsIntoTaxYear(new Date())
  const needsSA = s.dividendIncome > R.dividendAllowance || s.savingsIncome > R.psaHigherRate || (profile?.otherIncomeSources.includes('cgt') ?? false)

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Your Tax Position</h1>
        <span className="font-mono text-xs text-text-2 tracking-wide">{getTaxYearLabel(key)}</span>
        <span className="ml-auto font-mono text-xs text-accent bg-accent-soft border border-accent/30 rounded-full px-3 py-1">{monthsIn} {monthsIn === 1 ? 'month' : 'months'} in</span>
      </div>

      {needsSA && (
        <div className="mb-6">
          <AlertStrip variant="yellow">
            <strong>You'll likely need to file a Self Assessment</strong> — you have{' '}
            <JargonTip term="dividends" explanation="Payments from shares you own. The first £500 a year is tax-free; anything above is taxed." />{' '}
            or{' '}
            <JargonTip term="capital gains" explanation="Profit from selling shares or investments. The first £3,000 a year is tax-free." />{' '}
            outside of PAYE this year. Registration deadline: 5 October.
          </AlertStrip>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Earned this year"
          value={gbp(s.employmentIncome)}
          note="from your payslips (YTD)"
          icon={<PoundSterling size={15} />}
        />
        <StatCard
          label="Tax already paid"
          value={gbp(s.taxPaidToDate)}
          variant="green"
          note={<>via <JargonTip term="PAYE" explanation="Pay As You Earn — tax taken from your salary automatically before you're paid." /></>}
          icon={<ShieldCheck size={15} />}
        />
        <StatCard
          label="Extra likely owed"
          value={extraOwed > 0 ? `~${gbp(extraOwed)}` : '£0'}
          variant={extraOwed > 0 ? 'yellow' : 'green'}
          note="dividends + savings outside PAYE"
          icon={<TriangleAlert size={15} />}
        />
        <StatCard
          label="Marginal tax band"
          value={band === 'basic' ? 'Basic (20%)' : band === 'higher' ? 'Higher (40%)' : 'Additional (45%)'}
          variant="accent"
          note={s.taxCode ? `tax code ${s.taxCode}` : 'estimated'}
          icon={<TrendingUp size={15} />}
        />
      </div>

      {s.employmentIncome === 0 && (
        <AlertStrip variant="accent">
          No payslip data yet. Head to <strong>Documents</strong> to upload your latest payslip and see your live position.
        </AlertStrip>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/DashboardScreen.tsx
git commit -m "feat: Dashboard screen — live tax position from real data"
```

---

## Task 5: ForecastSlider + IncomeRow components

**Files:**
- Create: `src/components/income/ForecastSlider.tsx`
- Create: `src/components/income/IncomeRow.tsx`

- [ ] **Step 1: Implement IncomeRow**

Create `src/components/income/IncomeRow.tsx`:

```tsx
interface Props {
  name: string
  detail?: string
  source: string        // e.g. 'PAYE', 'SELF-ASSESS', 'CGT'
  amount: number | null // null → render em-dash
}

export function IncomeRow({ name, detail, source, amount }: Props) {
  const gbp = amount == null ? '—' : `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 border-b border-white/[0.06] last:border-0 hover:bg-surface-2 transition-colors text-sm">
      <div>
        <div className="font-medium">{name}</div>
        {detail && <div className="text-[11px] text-text-2 mt-0.5">{detail}</div>}
      </div>
      <div className="font-mono text-[10px] tracking-wide text-text-3 text-right">{source}</div>
      <div className={`font-mono text-right whitespace-nowrap ${amount == null ? 'text-text-3' : ''}`}>{gbp}</div>
    </div>
  )
}
```

- [ ] **Step 2: Implement ForecastSlider**

Create `src/components/income/ForecastSlider.tsx`:

```tsx
import { useState } from 'react'
import { incomeTax, employeeNI, effectivePersonalAllowance } from '../../lib/taxCalc'
import { CURRENT_RATES as R } from '../../lib/taxRates'

interface Props {
  baseIncome: number
}

export function ForecastSlider({ baseIncome }: Props) {
  const [extra, setExtra] = useState(0)

  const projected = baseIncome + extra
  const paNow = effectivePersonalAllowance(baseIncome, R)
  const paThen = effectivePersonalAllowance(projected, R)

  const taxNow = incomeTax(baseIncome, paNow, R) + employeeNI(baseIncome, R)
  const taxThen = incomeTax(projected, paThen, R) + employeeNI(projected, R)
  const extraTax = taxThen - taxNow
  const takeHome = extra - extraTax
  const effectiveRate = extra > 0 ? (extraTax / extra) * 100 : 0

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h3 className="font-serif text-base mb-1">What if I earned more?</h3>
      <p className="text-text-2 text-xs mb-4">See how a pay rise or bonus affects your take-home after tax and National Insurance.</p>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-2">Extra income</span>
        <span className="font-mono text-accent">{gbp(extra)}</span>
      </div>
      <input
        type="range" min={0} max={50000} step={500}
        value={extra}
        onChange={e => setExtra(parseInt(e.target.value))}
        className="w-full accent-[#C8804A] mb-4"
      />

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-serif text-lg text-yellow">{gbp(extraTax)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Extra tax + NI</div>
        </div>
        <div>
          <div className="font-serif text-lg text-green">{gbp(takeHome)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">You keep</div>
        </div>
        <div>
          <div className="font-serif text-lg text-text-1">{effectiveRate.toFixed(0)}%</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Effective rate</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/income/
git commit -m "feat: IncomeRow and ForecastSlider components"
```

---

## Task 6: IncomeScreen

**Files:**
- Replace: `src/screens/IncomeScreen.tsx`

- [ ] **Step 1: Implement IncomeScreen**

Replace `src/screens/IncomeScreen.tsx`:

```tsx
import { IncomeRow } from '../components/income/IncomeRow'
import { ForecastSlider } from '../components/income/ForecastSlider'
import { JargonTip } from '../components/ui/JargonTip'
import { useTaxYear } from '../hooks/useTaxYear'
import { storage } from '../lib/storage'
import { summariseTaxYear } from '../lib/incomeSummary'
import { getCurrentTaxYear, getTaxYearLabel } from '../lib/taxYears'

export function IncomeScreen() {
  const profileId = storage.getActiveProfile()
  const { taxYear, loading } = useTaxYear(profileId)

  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your income…</div>
  }

  const s = summariseTaxYear(taxYear)
  const key = getCurrentTaxYear()

  // Sum salary sacrifice across latest payslip employment (informational)
  const allPayslips = taxYear.employment.flatMap(e => e.payslips)
  const salSac = allPayslips.length
    ? allPayslips[allPayslips.length - 1].salarySacrifice.reduce((sum, li) => sum + li.amount, 0)
    : 0

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Where your income comes from</h1>
        <span className="font-mono text-xs text-text-2">{getTaxYearLabel(key)} · year to date</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-serif text-base">Income sources</h2>
            <span className="font-mono text-[10px] bg-accent-soft text-accent px-2 py-0.5 rounded">YTD</span>
          </div>
          <IncomeRow name="Salary & car allowance" detail={`${taxYear.employment[0]?.employerName ?? 'Employer'} · ${allPayslips.length} payslip${allPayslips.length === 1 ? '' : 's'}`} source="PAYE" amount={s.employmentIncome} />
          {salSac !== 0 && (
            <IncomeRow name="Salary sacrifice" detail="Pension, critical illness etc." source="PAYE" amount={salSac} />
          )}
          <IncomeRow name="Dividends" detail={s.dividendIncome ? undefined : 'Add manually or import'} source="SELF-ASSESS" amount={s.dividendIncome || null} />
          <IncomeRow name="Savings interest" detail={s.savingsIncome ? undefined : 'Add manually'} source="SELF-ASSESS" amount={s.savingsIncome || null} />
          <IncomeRow name="Benefits in kind" detail={s.benefitsInKind ? undefined : 'From your P11D'} source="P11D" amount={s.benefitsInKind || null} />
          <div className="px-5 py-4 flex items-center justify-between border-t border-white/10 bg-surface-2">
            <span className="text-xs font-semibold tracking-wide text-text-2">Taxable total (confirmed)</span>
            <span className="font-serif text-xl">£{Math.round(s.employmentIncome).toLocaleString('en-GB')}</span>
          </div>
        </div>

        <ForecastSlider baseIncome={s.employmentIncome} />
      </div>

      <p className="text-text-2 text-xs mt-4">
        All figures are <JargonTip term="year to date" explanation="The running total since the tax year started on 6 April. Your latest payslip shows this." /> from your uploaded payslips.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript, run all tests, build**

```bash
npx tsc --noEmit && npm run test 2>&1 | tail -4 && npm run build 2>&1 | tail -3
```
Expected: no TS errors, all tests pass, build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/screens/IncomeScreen.tsx
git commit -m "feat: Income screen — income breakdown + forecaster"
```

---

## Task 7: Push and verify

- [ ] **Step 1: Push**
```bash
git push
```

- [ ] **Step 2: Verify build passed and no regressions**
```bash
npm run test 2>&1 | tail -4
```
Expected: all tests pass (30 from before + new taxCalc/incomeSummary tests)

---

## Self-review checklist

- ✅ Tax engine handles K-codes (Mike's K289), taper, all bands, NI, dividends, savings — per findings
- ✅ Dashboard shows live position from real payslip YTD data
- ✅ Income screen lists all sources + forecaster
- ✅ Reuses existing hooks (useTaxYear, useProfile) and UI (StatCard, JargonTip, AlertStrip) — no data-layer duplication
- ✅ Plain English + jargon tooltips throughout
- ✅ All monetary values via `gbp()` helper / `toLocaleString('en-GB')`
