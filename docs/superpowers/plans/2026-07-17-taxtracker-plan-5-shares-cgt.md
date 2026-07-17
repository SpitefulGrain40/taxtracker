# TaxTracker Plan 5: Share Schemes + CGT Calculator

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Import SAP-style share portfolio exports into the lot register, and build a CGT "what if I sell?" calculator using UK Section 104 pooling.

**Architecture:** A pure `cgt.ts` computes the Section 104 average-cost pool and the gain/tax on a disposal. `portfolioImport.ts` parses the SAP `PortfolioDetails` XLSX (Excel serial dates, Purchase+Company-match row pairs, GBP/XETRA) into `ShareLot[]`. `SharesScreen` shows the lot register grouped by scheme, a holdings summary, and an interactive "sell N shares" calculator that reports the CGT due against the £3,000 annual exemption. Lots persist to `share-lots.json` via `dataRepo`. SheetJS (`xlsx`) parses the workbook in-browser.

**Findings baked in (from CLAUDE.md):** SAP = GBP/XETRA (no FX). Excel dates = serial numbers (epoch 1899-12-30). Each ESPP month = Purchase row + Company match row. RSU = one row per tranche.

**Tech Stack:** React 18, TS, Tailwind v4, Lucide, Vitest, `xlsx` (SheetJS). Reuses `dataRepo`, `taxRates`, `taxCalc` (marginalBand), `StatCard`, `StatusDot`.

---

## File structure

```
src/
├── lib/
│   ├── cgt.ts               NEW — Section 104 pool + disposal/tax calc (pure)
│   ├── cgt.test.ts          NEW
│   ├── portfolioImport.ts   NEW — parse SAP XLSX → ShareLot[] (+ excelToISO)
│   └── portfolioImport.test.ts NEW
├── screens/
│   └── SharesScreen.tsx     REPLACE placeholder
└── components/
    └── shares/
        ├── LotTable.tsx      NEW — lot register grouped by scheme
        └── SellCalculator.tsx NEW — "what if I sell N shares"
```

---

## Task 1: CGT engine (Section 104 pool)

**Files:**
- Create: `src/lib/cgt.ts`
- Create: `src/lib/cgt.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/cgt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { section104Pool, disposalGain, cgtOnDisposal } from './cgt'
import { RATES_2025_26 as R } from './taxRates'
import type { ShareLot } from '../types'

function lot(id: string, qty: number, costGBP: number): ShareLot {
  return {
    id, schemeId: 's1', employerName: 'SAP UK Limited', schemeType: 'espp-match',
    acquisitionDate: '2025-09-04', acquisitionPriceOriginal: costGBP, acquisitionPriceFX: 1,
    acquisitionPriceGBP: costGBP, quantity: qty, costBasisGBP: costGBP * qty,
  }
}

describe('section104Pool', () => {
  it('pools quantity and cost across lots', () => {
    const pool = section104Pool([lot('a', 10, 100), lot('b', 5, 120)])
    // 10 @ £100 (£1000) + 5 @ £120 (£600) = 15 shares, £1600 total cost
    expect(pool.quantity).toBe(15)
    expect(pool.totalCost).toBeCloseTo(1600, 2)
    expect(pool.averageCost).toBeCloseTo(1600 / 15, 4)
  })
  it('ignores already-disposed lots', () => {
    const disposed = { ...lot('c', 8, 100), disposalDate: '2026-01-01' }
    const pool = section104Pool([lot('a', 10, 100), disposed])
    expect(pool.quantity).toBe(10)
  })
  it('handles empty', () => {
    expect(section104Pool([]).quantity).toBe(0)
    expect(section104Pool([]).averageCost).toBe(0)
  })
})

describe('disposalGain', () => {
  it('computes gain from average cost', () => {
    // pool avg £106.67/share; sell 6 @ £150 = £900 proceeds, cost 6*106.67=£640, gain £260
    const pool = section104Pool([lot('a', 10, 100), lot('b', 5, 120)])
    const g = disposalGain(pool, 6, 150)
    expect(g.proceeds).toBeCloseTo(900, 2)
    expect(g.costOfSold).toBeCloseTo(6 * (1600 / 15), 2)
    expect(g.gain).toBeCloseTo(900 - 6 * (1600 / 15), 2)
  })
  it('gain is zero if selling at average cost', () => {
    const pool = section104Pool([lot('a', 10, 100)])
    const g = disposalGain(pool, 5, 100)
    expect(g.gain).toBeCloseTo(0, 2)
  })
})

describe('cgtOnDisposal', () => {
  it('applies annual exempt amount then CGT rate', () => {
    // gain £5,000, £3,000 exempt → £2,000 taxable. Higher-rate taxpayer 24% = £480
    const r = cgtOnDisposal(5000, 'higher', 0, R)
    expect(r.taxableGain).toBe(2000)
    expect(r.tax).toBeCloseTo(480, 2)
  })
  it('uses basic rate 18% for basic-rate taxpayer', () => {
    const r = cgtOnDisposal(5000, 'basic', 0, R)
    expect(r.tax).toBeCloseTo(2000 * 0.18, 2)
  })
  it('reduces remaining exemption by exemptionUsed', () => {
    // £3,000 already used → full £5,000 gain taxable
    const r = cgtOnDisposal(5000, 'higher', 3000, R)
    expect(r.taxableGain).toBe(5000)
  })
  it('no tax when gain within remaining exemption', () => {
    const r = cgtOnDisposal(2000, 'higher', 0, R)
    expect(r.taxableGain).toBe(0)
    expect(r.tax).toBe(0)
  })
})
```

- [ ] **Step 2: Confirm fail**

```bash
cd "C:/Users/I578036/Documents/TaxTracker"
npm run test -- cgt.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement cgt.ts**

Create `src/lib/cgt.ts`:

```ts
import type { ShareLot } from '../types'
import type { TaxRates } from './taxRates'
import type { Band } from './taxCalc'

export interface Section104 {
  quantity: number
  totalCost: number      // GBP
  averageCost: number    // GBP per share
}

/** Build the Section 104 holding pool from all non-disposed lots. */
export function section104Pool(lots: ShareLot[]): Section104 {
  const held = lots.filter(l => !l.disposalDate)
  const quantity = held.reduce((s, l) => s + l.quantity, 0)
  const totalCost = held.reduce((s, l) => s + l.costBasisGBP, 0)
  return {
    quantity,
    totalCost,
    averageCost: quantity > 0 ? totalCost / quantity : 0,
  }
}

export interface DisposalGain {
  proceeds: number
  costOfSold: number
  gain: number
}

/** Gain from selling `quantity` shares at `pricePerShare`, using pool average cost. */
export function disposalGain(pool: Section104, quantity: number, pricePerShare: number): DisposalGain {
  const proceeds = quantity * pricePerShare
  const costOfSold = quantity * pool.averageCost
  return { proceeds, costOfSold, gain: proceeds - costOfSold }
}

export interface CgtResult {
  taxableGain: number
  tax: number
  exemptionApplied: number
}

/**
 * CGT on a total gain for the year.
 * `exemptionUsed` = annual exempt amount already consumed by other disposals this year.
 * CGT band: shares use 18% (basic) / 24% (higher/additional) for 2025-26.
 */
export function cgtOnDisposal(gain: number, band: Band, exemptionUsed: number, r: TaxRates): CgtResult {
  const remainingExemption = Math.max(0, r.cgtAnnualExempt - exemptionUsed)
  const exemptionApplied = Math.min(gain, remainingExemption)
  const taxableGain = Math.max(0, gain - exemptionApplied)
  const rate = band === 'basic' ? r.cgtBasicRate : r.cgtHigherRate
  return { taxableGain, tax: taxableGain * rate, exemptionApplied }
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- cgt.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/cgt.ts src/lib/cgt.test.ts
git commit -m "feat: CGT engine — Section 104 pooling + disposal tax"
```

---

## Task 2: Portfolio import

**Files:**
- Create: `src/lib/portfolioImport.ts`
- Create: `src/lib/portfolioImport.test.ts`

- [ ] **Step 1: Install SheetJS**

```bash
npm install xlsx
```

- [ ] **Step 2: Write failing tests**

Create `src/lib/portfolioImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { excelToISO, rowsToLots } from './portfolioImport'

describe('excelToISO', () => {
  it('converts Excel serial to ISO date', () => {
    expect(excelToISO(45904)).toBe('2025-09-04')
    expect(excelToISO(46209)).toBe('2026-07-06')
  })
})

describe('rowsToLots', () => {
  // Simulates parsed rows from a SAP PortfolioDetails export (header + data)
  const rows = [
    ['Allocation date', 'Plan', 'Instrument type', 'Instrument', 'Participation description', 'Contribution type', 'Strike price / Cost basis', 'Market price', 'Available from', 'Expiry date', 'Allocated quantity', 'Outstanding quantity', 'Available quantity'],
    [45904, 'Own SAP', 'shares', 'Own SAP', 'OWN Purchase September 2025', 'Purchase', 233.30335, 137.64, 45904, '', 1.28948, 1.28948, 1.28948],
    [45904, 'Own SAP', 'shares', 'Own SAP', 'OWN Purchase September 2025', 'Company match', 233.30335, 137.64, 45904, '', 0.59909, 0.59909, 0.59909],
    [46091, 'Elevate & Move SAP', 'restricted stock units', 'Elevate SAP - RSU share-settled', 'Elevate Annual Share 2026Q1', 'Award', 137.64, 46456, 401768, '', 44.597, 44.597, 0],
  ]

  it('maps Purchase and Company match rows to espp-match lots', () => {
    const lots = rowsToLots(rows, 'scheme-1', 'SAP UK Limited')
    const espp = lots.filter(l => l.schemeType === 'espp-match')
    expect(espp).toHaveLength(2)
    expect(espp[0].quantity).toBeCloseTo(1.28948, 5)
    expect(espp[0].acquisitionDate).toBe('2025-09-04')
    expect(espp[0].acquisitionPriceGBP).toBeCloseTo(233.30335, 4)
    expect(espp[0].costBasisGBP).toBeCloseTo(233.30335 * 1.28948, 2)
  })

  it('maps RSU award rows to rsu lots', () => {
    const lots = rowsToLots(rows, 'scheme-1', 'SAP UK Limited')
    const rsu = lots.filter(l => l.schemeType === 'rsu')
    expect(rsu).toHaveLength(1)
    expect(rsu[0].quantity).toBeCloseTo(44.597, 3)
    expect(rsu[0].costBasisGBP).toBeCloseTo(137.64 * 44.597, 2)
  })

  it('skips zero-quantity and malformed rows', () => {
    const withBlank = [...rows, [null, '', '', '', '', '', '', '', '', '', 0, 0, 0]]
    const lots = rowsToLots(withBlank, 'scheme-1', 'SAP UK Limited')
    expect(lots).toHaveLength(3)  // blank row ignored
  })
})
```

- [ ] **Step 3: Confirm fail, then implement portfolioImport.ts**

Create `src/lib/portfolioImport.ts`:

```ts
import * as XLSX from 'xlsx'
import type { ShareLot, SchemeType } from '../types'

/** Excel serial date (epoch 1899-12-30) → ISO yyyy-mm-dd. */
export function excelToISO(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
  return d.toISOString().slice(0, 10)
}

type Row = (string | number | null)[]

const COL = {
  allocationDate: 0,
  instrumentType: 2,
  costBasis: 6,
  marketPrice: 7,
  quantity: 10,
}

/** Determine scheme type from the instrument-type column text. */
function schemeTypeFor(instrumentType: string): SchemeType {
  const t = instrumentType.toLowerCase()
  if (t.includes('restricted stock') || t.includes('rsu')) return 'rsu'
  return 'espp-match'
}

/**
 * Convert parsed portfolio rows (first row = header) into ShareLots.
 * SAP export: ESPP months produce Purchase + Company match rows; RSU awards produce
 * one row per tranche. Cost basis and market price are already in GBP (XETRA).
 */
export function rowsToLots(rows: Row[], schemeId: string, employerName: string): ShareLot[] {
  const dataRows = rows.slice(1) // drop header
  const lots: ShareLot[] = []
  for (const row of dataRows) {
    const dateCell = row[COL.allocationDate]
    const qty = Number(row[COL.quantity])
    const cost = Number(row[COL.costBasis])
    const market = Number(row[COL.marketPrice])
    const instrumentType = String(row[COL.instrumentType] ?? '')
    if (typeof dateCell !== 'number' || !Number.isFinite(qty) || qty <= 0) continue

    const schemeType = schemeTypeFor(instrumentType)
    // RSU cost basis is the market value at vest (the "Strike price / Cost basis" col
    // holds the vest price for RSUs); ESPP cost basis is the purchase price.
    const perShareGBP = Number.isFinite(cost) && cost > 0 ? cost : market
    lots.push({
      id: crypto.randomUUID(),
      schemeId,
      employerName,
      schemeType,
      acquisitionDate: excelToISO(dateCell),
      acquisitionPriceOriginal: perShareGBP,
      acquisitionPriceFX: 1,          // GBP — no conversion for SAP/XETRA
      acquisitionPriceGBP: perShareGBP,
      quantity: qty,
      costBasisGBP: perShareGBP * qty,
    })
  }
  return lots
}

/** Parse an uploaded XLSX File into rows, then into lots. */
export async function parsePortfolioFile(file: File, schemeId: string, employerName: string): Promise<ShareLot[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: null })
  // Find the header row (the one containing "Allocation date")
  const headerIdx = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('allocation date')))
  const relevant = headerIdx >= 0 ? rows.slice(headerIdx) : rows
  return rowsToLots(relevant, schemeId, employerName)
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- portfolioImport.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/portfolioImport.ts src/lib/portfolioImport.test.ts package.json package-lock.json
git commit -m "feat: SAP portfolio XLSX import — Section 104 lots, Excel dates, GBP"
```

---

## Task 3: LotTable + SellCalculator + SharesScreen

**Files:**
- Create: `src/components/shares/LotTable.tsx`
- Create: `src/components/shares/SellCalculator.tsx`
- Replace: `src/screens/SharesScreen.tsx`

- [ ] **Step 1: LotTable**

Create `src/components/shares/LotTable.tsx`:

```tsx
import type { ShareLot } from '../../types'

interface Props {
  lots: ShareLot[]
}

const schemeLabel: Record<string, string> = {
  'espp-match': 'ESPP (match)',
  'espp-discounted': 'ESPP (discounted)',
  'rsu': 'RSU',
  'csop': 'CSOP', 'emi': 'EMI', 'saye': 'SAYE',
}

export function LotTable({ lots }: Props) {
  const held = lots.filter(l => !l.disposalDate)
  if (held.length === 0) {
    return <p className="text-text-2 text-sm px-5 py-6">No share lots yet. Import a portfolio export to populate your register.</p>
  }
  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-text-2 border-b border-white/[0.06]">
            <th className="text-left font-medium px-5 py-2.5">Acquired</th>
            <th className="text-left font-medium px-3 py-2.5">Scheme</th>
            <th className="text-right font-medium px-3 py-2.5">Qty</th>
            <th className="text-right font-medium px-3 py-2.5">Cost/share</th>
            <th className="text-right font-medium px-5 py-2.5">Cost basis</th>
          </tr>
        </thead>
        <tbody>
          {held.map(l => (
            <tr key={l.id} className="border-b border-white/[0.04] hover:bg-surface-2 transition-colors">
              <td className="px-5 py-2.5 font-mono text-xs">{l.acquisitionDate}</td>
              <td className="px-3 py-2.5 text-text-2">{schemeLabel[l.schemeType] ?? l.schemeType}</td>
              <td className="px-3 py-2.5 text-right font-mono">{l.quantity.toFixed(4)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{gbp(l.acquisitionPriceGBP)}</td>
              <td className="px-5 py-2.5 text-right font-mono">{gbp(l.costBasisGBP)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: SellCalculator**

Create `src/components/shares/SellCalculator.tsx`:

```tsx
import { useState } from 'react'
import { JargonTip } from '../ui/JargonTip'
import { section104Pool, disposalGain, cgtOnDisposal } from '../../lib/cgt'
import { CURRENT_RATES as R } from '../../lib/taxRates'
import type { ShareLot } from '../../types'
import type { Band } from '../../lib/taxCalc'

interface Props {
  lots: ShareLot[]
  currentPrice: number      // market price per share (GBP)
  band: Band
}

export function SellCalculator({ lots, currentPrice, band }: Props) {
  const pool = section104Pool(lots)
  const [qty, setQty] = useState(0)
  const [price, setPrice] = useState(currentPrice)

  const g = disposalGain(pool, qty, price)
  const cgt = cgtOnDisposal(Math.max(0, g.gain), band, 0, R)
  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const maxQty = Math.floor(pool.quantity)

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h3 className="font-serif text-base mb-1">If I sell shares today…</h3>
      <p className="text-text-2 text-xs mb-4">
        Estimates the <JargonTip term="capital gains tax" explanation="Tax on the profit when you sell shares. The first £3,000 of gains each year is tax-free; the rest is taxed at 18% (basic rate) or 24% (higher rate)." /> using your average cost across all holdings.
      </p>

      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-2">Shares to sell (max {maxQty})</span>
            <span className="font-mono text-accent">{qty}</span>
          </div>
          <input type="range" min={0} max={maxQty} step={1} value={qty} onChange={e => setQty(parseInt(e.target.value))} className="w-full accent-[#C8804A]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-2 flex-1">Price per share</span>
          <span className="font-mono text-xs text-text-2">£</span>
          <input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} step={0.01}
            className="w-24 bg-bg border border-white/10 rounded px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-accent/50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center border-t border-white/[0.06] pt-4">
        <div>
          <div className="font-serif text-lg">{gbp(g.proceeds)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Proceeds</div>
        </div>
        <div>
          <div className={`font-serif text-lg ${g.gain >= 0 ? 'text-green' : 'text-red'}`}>{gbp(g.gain)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Gain</div>
        </div>
        <div>
          <div className="font-serif text-lg text-text-1">{gbp(cgt.exemptionApplied)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Tax-free allowance used</div>
        </div>
        <div>
          <div className="font-serif text-lg text-yellow">{gbp(cgt.tax)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">CGT owed</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: SharesScreen**

Replace `src/screens/SharesScreen.tsx`:

```tsx
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { LotTable } from '../components/shares/LotTable'
import { SellCalculator } from '../components/shares/SellCalculator'
import { UploadZone } from '../components/documents/UploadZone'
import { StatCard } from '../components/ui/StatCard'
import { AlertStrip } from '../components/ui/AlertStrip'
import { useProfile } from '../hooks/useProfile'
import { useTaxYear } from '../hooks/useTaxYear'
import { storage } from '../lib/storage'
import { getDataClient } from '../lib/github'
import { readShareLots, writeShareLots } from '../lib/dataRepo'
import { parsePortfolioFile } from '../lib/portfolioImport'
import { section104Pool } from '../lib/cgt'
import { summariseTaxYear } from '../lib/incomeSummary'
import { marginalBand } from '../lib/taxCalc'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { useEffect } from 'react'
import type { ShareLot } from '../types'

export function SharesScreen() {
  const profileId = storage.getActiveProfile()
  const { profile } = useProfile(profileId)
  const { taxYear } = useTaxYear(profileId)

  const [lots, setLots] = useState<ShareLot[] | null>(null)
  const [sha, setSha] = useState<string | undefined>(undefined)
  const [state, setState] = useState<'idle' | 'importing' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Load lots from data repo
  useEffect(() => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) { setLots([]); return }
    const client = getDataClient(pat, repo)
    readShareLots(client, profileId)
      .then(res => { setLots(res?.data ?? []); setSha(res?.sha) })
      .catch(() => setLots([]))
  }, [profileId])

  if (lots === null) return <div className="text-text-2 text-sm py-8">Loading your shares…</div>

  const pool = section104Pool(lots)
  const scheme = profile?.schemes[0]
  // Market price: take the most recent lot's implied market or fall back to average cost
  const marketPrice = lots.length ? (lots[lots.length - 1].acquisitionPriceGBP) : 0
  const currentValue = pool.quantity * marketPrice
  const unrealised = currentValue - pool.totalCost

  const band = taxYear ? marginalBand(summariseTaxYear(taxYear).employmentIncome, R) : 'higher'
  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  const handleImport = async (file: File) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo || !scheme) { setErrorMsg('Configure a share scheme in onboarding first.'); setState('error'); return }
    setState('importing')
    try {
      const imported = await parsePortfolioFile(file, scheme.id, scheme.employerName)
      const merged = [...lots, ...imported]
      const client = getDataClient(pat, repo)
      await writeShareLots(client, profileId, merged, sha)
      // refetch sha
      const res = await readShareLots(client, profileId)
      setLots(res?.data ?? merged); setSha(res?.sha)
      setState('idle')
    } catch (e) {
      setErrorMsg(String(e)); setState('error')
    }
  }

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Share Schemes</h1>
        {scheme && <span className="font-mono text-xs text-text-2">{scheme.employerName} · {scheme.currency}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Shares held" value={pool.quantity.toFixed(2)} note={`${lots.filter(l => !l.disposalDate).length} lots`} />
        <StatCard label="Est. current value" value={gbp(currentValue)} variant="green" note={`at £${marketPrice.toFixed(2)}/share`} />
        <StatCard label="Unrealised gain" value={gbp(unrealised)} variant={unrealised >= 0 ? 'yellow' : 'red'} note="if sold at current price" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-serif text-base">Lot register</h2>
            <span className="font-mono text-[10px] text-text-2">{lots.filter(l => !l.disposalDate).length} holdings</span>
          </div>
          <LotTable lots={lots} />
          <div className="p-5 border-t border-white/[0.06]">
            {state === 'importing' && <p className="text-text-2 text-sm">Importing portfolio…</p>}
            {state === 'error' && (
              <div className="flex items-start gap-2 text-sm text-red mb-3">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorMsg}
              </div>
            )}
            {state !== 'importing' && (
              <UploadZone label="Import portfolio export (.xlsx)" hint="From your broker — Fidelity, SAP, etc." onFile={handleImport} />
            )}
          </div>
        </div>

        <SellCalculator lots={lots} currentPrice={marketPrice} band={band} />
      </div>

      {!scheme && (
        <div className="mt-6">
          <AlertStrip variant="accent">No share scheme configured. Add one in Settings to import your portfolio.</AlertStrip>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: TypeScript, tests, build**

```bash
npx tsc --noEmit && npm run test 2>&1 | tail -4 && npm run build 2>&1 | tail -3
```
Expected: clean

- [ ] **Step 5: Commit + push**

```bash
git add src/components/shares/ src/screens/SharesScreen.tsx
git commit -m "feat: Share Schemes screen — lot register, portfolio import, CGT sell calculator"
git push
```

---

## Self-review checklist

- ✅ Section 104 pooling (correct UK CGT method for shares) — not naive FIFO
- ✅ Excel serial dates converted (findings)
- ✅ Purchase + Company match rows both imported as espp-match lots (findings)
- ✅ RSU rows → rsu lots with vest-price cost basis (findings)
- ✅ GBP/no-FX for SAP (findings) — FX field kept at 1
- ✅ CGT applies £3,000 annual exemption, 18%/24% by band
- ✅ Reuses dataRepo (readShareLots/writeShareLots), taxCalc.marginalBand, StatCard, UploadZone
- ⚠️ Simplification (acceptable for v1, note for later): market price is taken from the latest lot's acquisition price as a proxy — a live price feed would be better; same-day/30-day CGT matching rules are not modelled (pure S104 pool). Flag both in the final test report.
