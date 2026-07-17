# TaxTracker Plan 6: Tax Return Builder + Encrypted Export

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** A Tax Return screen that maps the user's captured data onto HMRC SA100/SA102/CGT boxes with plain-English explanations, shows a completion status, offers copy-to-clipboard, and an encrypted export for an accountant.

**Architecture:** A pure `taxReturn.ts` assembles a `TaxReturnModel` (list of HMRC sections, each with boxes: number, HMRC label, plain-English description, value, completeness). It composes the existing engines: `summariseTaxYear` (income), `taxCalc` (band/tax), `cgt` (gains from share lots). `encryptedExport.ts` uses Web Crypto AES-GCM + PBKDF2 to produce a password-protected JSON blob. `TaxReturnScreen` renders sections as cards with box rows, a readiness score, copy buttons, and an export dialog. **Uses total-income band classification** (income + dividends + savings) — addressing the note from Plan 3's review.

**Tech Stack:** React 18, TS, Tailwind v4, Lucide, Vitest, Web Crypto API. Reuses `incomeSummary`, `taxCalc`, `cgt`, `dataRepo`, `StatusDot`, `JargonTip`.

---

## File structure

```
src/
├── lib/
│   ├── taxReturn.ts          NEW — assemble SA100/SA102/CGT model (pure)
│   ├── taxReturn.test.ts     NEW
│   ├── encryptedExport.ts    NEW — AES-GCM encrypt/decrypt JSON with password
│   └── encryptedExport.test.ts NEW
├── screens/
│   └── TaxReturnScreen.tsx   REPLACE placeholder
└── components/
    └── taxreturn/
        ├── ReturnSection.tsx  NEW — one HMRC section card with box rows
        └── ExportDialog.tsx   NEW — password + download encrypted export
```

---

## Task 1: Tax return model

**Files:**
- Create: `src/lib/taxReturn.ts`
- Create: `src/lib/taxReturn.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/taxReturn.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildTaxReturn, totalTaxableIncome } from './taxReturn'
import { emptyTaxYear } from './dataRepo'
import { RATES_2025_26 as R } from './taxRates'
import type { TaxYear, ShareLot } from '../types'

function fullYear(): TaxYear {
  const ty = emptyTaxYear('2025-26')
  ty.employment = [{
    id: 'e1', employerName: 'SAP UK Limited',
    payslips: [{
      id: 'p1', taxPeriod: 12, taxYear: '2025-26', date: '2026-04-05',
      basicSalary: 0, carAllowance: 0, otherPayments: [], taxPaid: 0, employeeNI: 0,
      salarySacrifice: [], esppContribution: 0, employerMatch: 0,
      ytdGross: 105480, ytdTaxPaid: 28620, ytdEmployeeNI: 4100,
      taxCode: 'K289', niNumber: 'JL041798C', employerName: 'SAP UK Limited', rawExtracted: {},
    }],
  }]
  ty.dividends = [{ id: 'd1', description: 'SAP', amount: 800, date: '2026-01-01', taxYear: '2025-26' }]
  ty.savingsInterest = [{ id: 's1', provider: 'Bank', grossInterest: 1200, taxYear: '2025-26' }]
  ty.benefitsInKind = [{ id: 'b1', type: 'medical', description: 'Private medical', taxableValue: 1450, taxYear: '2025-26' }]
  return ty
}

describe('totalTaxableIncome', () => {
  it('sums employment + dividends + savings + benefits', () => {
    const total = totalTaxableIncome(fullYear())
    expect(total).toBeCloseTo(105480 + 800 + 1200 + 1450, 2)
  })
})

describe('buildTaxReturn', () => {
  it('produces SA102 employment section with pay + tax boxes', () => {
    const model = buildTaxReturn(fullYear(), [], R)
    const sa102 = model.sections.find(s => s.code === 'SA102')
    expect(sa102).toBeTruthy()
    const payBox = sa102!.boxes.find(b => b.box === '1')
    expect(payBox?.value).toBeCloseTo(105480, 2)
    const taxBox = sa102!.boxes.find(b => b.box === '2')
    expect(taxBox?.value).toBeCloseTo(28620, 2)
  })

  it('includes benefits in SA102', () => {
    const model = buildTaxReturn(fullYear(), [], R)
    const sa102 = model.sections.find(s => s.code === 'SA102')
    const benefitBox = sa102!.boxes.find(b => b.label.toLowerCase().includes('benefit'))
    expect(benefitBox?.value).toBeCloseTo(1450, 2)
  })

  it('produces dividends and savings sections', () => {
    const model = buildTaxReturn(fullYear(), [], R)
    expect(model.sections.find(s => s.code === 'DIV')?.boxes[0].value).toBe(800)
    expect(model.sections.find(s => s.code === 'SAV')?.boxes[0].value).toBe(1200)
  })

  it('CGT section reflects share pool gain when lots present', () => {
    const lots: ShareLot[] = [{
      id: 'l1', schemeId: 's1', employerName: 'SAP', schemeType: 'espp-match',
      acquisitionDate: '2025-09-04', acquisitionPriceOriginal: 100, acquisitionPriceFX: 1,
      acquisitionPriceGBP: 100, quantity: 10, costBasisGBP: 1000,
    }]
    const model = buildTaxReturn(fullYear(), lots, R)
    const cgt = model.sections.find(s => s.code === 'CGT')
    expect(cgt).toBeTruthy()
  })

  it('reports readiness — sections needing input are flagged incomplete', () => {
    const empty = emptyTaxYear('2025-26')
    const model = buildTaxReturn(empty, [], R)
    expect(model.readyCount).toBeLessThan(model.totalSections)
  })

  it('classifies band on TOTAL income not just employment', () => {
    // £48k employment + £5k dividends + £3k savings = £56k total → higher rate
    const ty = emptyTaxYear('2025-26')
    ty.employment = [{ id: 'e', employerName: 'X', payslips: [{
      id: 'p', taxPeriod: 12, taxYear: '2025-26', date: '2026-04-05',
      basicSalary: 0, carAllowance: 0, otherPayments: [], taxPaid: 0, employeeNI: 0,
      salarySacrifice: [], esppContribution: 0, employerMatch: 0,
      ytdGross: 48000, ytdTaxPaid: 7000, ytdEmployeeNI: 3000,
      taxCode: '1257L', niNumber: '', employerName: 'X', rawExtracted: {},
    }] }]
    ty.dividends = [{ id: 'd', description: 'x', amount: 5000, date: '2026-01-01', taxYear: '2025-26' }]
    ty.savingsInterest = [{ id: 's', provider: 'x', grossInterest: 3000, taxYear: '2025-26' }]
    const model = buildTaxReturn(ty, [], R)
    expect(model.band).toBe('higher')
  })
})
```

- [ ] **Step 2: Confirm fail**

```bash
cd "C:/Users/I578036/Documents/TaxTracker"
npm run test -- taxReturn.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement taxReturn.ts**

Create `src/lib/taxReturn.ts`:

```ts
import type { TaxYear, ShareLot } from '../types'
import type { TaxRates } from './taxRates'
import type { Band } from './taxCalc'
import { marginalBand, dividendTax, savingsTax } from './taxCalc'
import { summariseTaxYear } from './incomeSummary'
import { section104Pool } from './cgt'

export interface ReturnBox {
  box: string          // HMRC box number, e.g. '1'
  label: string        // official HMRC label
  plainEnglish: string // layman explanation
  value: number | null // null = needs input
  source: string       // where it came from, e.g. 'P60' / 'Manual'
}

export interface ReturnSection {
  code: 'SA102' | 'DIV' | 'SAV' | 'CGT'
  title: string
  boxes: ReturnBox[]
  complete: boolean
}

export interface TaxReturnModel {
  taxYear: string
  band: Band
  sections: ReturnSection[]
  readyCount: number
  totalSections: number
}

/** Total taxable income across all sources (used for band classification). */
export function totalTaxableIncome(ty: TaxYear): number {
  const s = summariseTaxYear(ty)
  return s.employmentIncome + s.dividendIncome + s.savingsIncome + s.benefitsInKind
}

export function buildTaxReturn(ty: TaxYear, lots: ShareLot[], r: TaxRates): TaxReturnModel {
  const s = summariseTaxYear(ty)
  const total = totalTaxableIncome(ty)
  const band = marginalBand(total, r)

  // SA102 — Employment
  const sa102: ReturnSection = {
    code: 'SA102',
    title: 'Employment (SA102)',
    complete: s.employmentIncome > 0,
    boxes: [
      { box: '1', label: 'Pay from this employment', plainEnglish: 'Your total salary and car allowance this tax year, from your P60.', value: s.employmentIncome || null, source: 'P60 / payslips' },
      { box: '2', label: 'UK tax taken off pay', plainEnglish: 'Tax already deducted through PAYE — enter exactly as shown.', value: s.taxPaidToDate || null, source: 'P60 / payslips' },
      { box: '5', label: 'Benefits and expenses (from P11D)', plainEnglish: 'Perks like private medical insurance or a company car. From your P11D.', value: s.benefitsInKind || null, source: 'P11D' },
    ],
  }

  // Dividends
  const divSection: ReturnSection = {
    code: 'DIV',
    title: 'Dividends',
    complete: s.dividendIncome > 0 || (ty.dividends.length > 0),
    boxes: [
      { box: '4', label: 'Dividends from UK companies', plainEnglish: 'Total dividend payments from shares. First £500 is tax-free.', value: s.dividendIncome || null, source: 'Manual / import' },
    ],
  }

  // Savings
  const savSection: ReturnSection = {
    code: 'SAV',
    title: 'Interest and savings',
    complete: s.savingsIncome > 0 || (ty.savingsInterest.length > 0),
    boxes: [
      { box: '2', label: 'Taxed & untaxed UK interest', plainEnglish: 'Interest from savings accounts. Basic-rate taxpayers get £1,000 tax-free.', value: s.savingsIncome || null, source: 'Manual' },
    ],
  }

  // CGT
  const pool = section104Pool(lots)
  const cgtSection: ReturnSection = {
    code: 'CGT',
    title: 'Capital gains (shares)',
    complete: pool.quantity > 0,
    boxes: [
      { box: '—', label: 'Shares held (Section 104 pool)', plainEnglish: 'Total shares you hold and their average cost. Gains are only taxed when you sell.', value: pool.quantity || null, source: 'Portfolio import' },
      { box: '—', label: 'Total cost basis of holdings', plainEnglish: 'What you paid (or the value taxed at vest) for the shares you still hold.', value: pool.totalCost || null, source: 'Portfolio import' },
    ],
  }

  const sections = [sa102, divSection, savSection, cgtSection]
  // A section only counts toward readiness if it's relevant (has any data)
  const relevant = sections.filter(sec =>
    sec.code === 'SA102' ||
    (sec.code === 'DIV' && ty.dividends.length > 0) ||
    (sec.code === 'SAV' && ty.savingsInterest.length > 0) ||
    (sec.code === 'CGT' && lots.length > 0)
  )
  const readyCount = relevant.filter(sec => sec.complete).length

  // Reference the tax functions so the module owns the full tax picture (used by callers)
  void dividendTax; void savingsTax

  return {
    taxYear: ty.key,
    band,
    sections,
    readyCount,
    totalSections: relevant.length,
  }
}
```

**NOTE FOR IMPLEMENTER:** Remove the `void dividendTax; void savingsTax` line and the unused imports of `dividendTax`/`savingsTax` if `tsc -b` (noUnusedLocals) complains — they're imported for potential use but if unused, drop them from the import statement entirely. Keep `marginalBand`, `summariseTaxYear`, `section104Pool` which ARE used.

- [ ] **Step 4: Run tests**

```bash
npm run test -- taxReturn.test.ts
```
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/lib/taxReturn.ts src/lib/taxReturn.test.ts
git commit -m "feat: tax return model — SA102/dividends/savings/CGT box mapping"
```

---

## Task 2: Encrypted export

**Files:**
- Create: `src/lib/encryptedExport.ts`
- Create: `src/lib/encryptedExport.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/encryptedExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encryptJSON, decryptJSON } from './encryptedExport'

describe('encryptedExport', () => {
  it('round-trips data with the correct password', async () => {
    const data = { name: 'Mike', total: 105480, sections: ['a', 'b'] }
    const blob = await encryptJSON(data, 'correct horse battery')
    const back = await decryptJSON(blob, 'correct horse battery')
    expect(back).toEqual(data)
  })

  it('produces a blob with salt, iv and ciphertext', async () => {
    const blob = await encryptJSON({ x: 1 }, 'pw')
    expect(blob.salt).toBeTruthy()
    expect(blob.iv).toBeTruthy()
    expect(blob.ciphertext).toBeTruthy()
    expect(blob.algorithm).toBe('AES-GCM')
  })

  it('fails to decrypt with the wrong password', async () => {
    const blob = await encryptJSON({ secret: 42 }, 'right')
    await expect(decryptJSON(blob, 'wrong')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Confirm fail, implement encryptedExport.ts**

Create `src/lib/encryptedExport.ts`:

```ts
export interface EncryptedBlob {
  algorithm: 'AES-GCM'
  salt: string       // base64
  iv: string         // base64
  ciphertext: string // base64
}

const ITERATIONS = 100_000

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptJSON(data: unknown, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    algorithm: 'AES-GCM',
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(ct)),
  }
}

export async function decryptJSON<T = unknown>(blob: EncryptedBlob, password: string): Promise<T> {
  const salt = unb64(blob.salt)
  const iv = unb64(blob.iv)
  const key = await deriveKey(password, salt)
  const ct = unb64(blob.ciphertext)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return JSON.parse(new TextDecoder().decode(pt)) as T
}
```

- [ ] **Step 3: Run tests**

```bash
npm run test -- encryptedExport.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/encryptedExport.ts src/lib/encryptedExport.test.ts
git commit -m "feat: AES-GCM encrypted export for accountant sharing"
```

---

## Task 3: ReturnSection + ExportDialog + TaxReturnScreen

**Files:**
- Create: `src/components/taxreturn/ReturnSection.tsx`
- Create: `src/components/taxreturn/ExportDialog.tsx`
- Replace: `src/screens/TaxReturnScreen.tsx`

- [ ] **Step 1: ReturnSection**

Create `src/components/taxreturn/ReturnSection.tsx`:

```tsx
import { JargonTip } from '../ui/JargonTip'
import { StatusDot } from '../ui/StatusDot'
import type { ReturnSection as Section } from '../../lib/taxReturn'

interface Props {
  section: Section
}

export function ReturnSection({ section }: Props) {
  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <h2 className="font-serif text-base">{section.title}</h2>
        <div className="flex items-center gap-2">
          <StatusDot status={section.complete ? 'green' : 'yellow'} />
          <span className="text-[11px] text-text-2">{section.complete ? 'Ready' : 'Needs input'}</span>
        </div>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {section.boxes.map((b, i) => (
          <div key={i} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  {b.box !== '—' && <span className="font-mono text-[10px] text-text-3">Box {b.box}</span>}
                  <span className="text-sm font-medium">{b.label}</span>
                </div>
                <p className="text-[11px] text-text-2 mt-1">{b.plainEnglish}</p>
              </div>
              <div className={`font-mono text-sm whitespace-nowrap ${b.value == null ? 'text-text-3' : ''}`}>
                {b.value == null ? '—' : gbp(b.value)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ExportDialog**

Create `src/components/taxreturn/ExportDialog.tsx`:

```tsx
import { useState } from 'react'
import { Lock, Download, X } from 'lucide-react'
import { encryptJSON } from '../../lib/encryptedExport'

interface Props {
  data: unknown
  filename: string
  onClose: () => void
}

export function ExportDialog({ data, filename, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    if (password.length < 6) return
    setBusy(true)
    try {
      const blob = await encryptJSON(data, password)
      const json = JSON.stringify(blob, null, 2)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-surface border border-white/10 rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-accent" />
            <h3 className="font-serif text-lg">Export for accountant</h3>
          </div>
          <button onClick={onClose} className="text-text-2 hover:text-text-1"><X size={16} /></button>
        </div>
        <p className="text-text-2 text-sm mb-4">Your tax figures will be encrypted with a password. Share the file and password separately for safety.</p>
        <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Password (min 6 chars)</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono mb-4 focus:outline-none focus:border-accent/50" />
        <button onClick={handleExport} disabled={password.length < 6 || busy}
          className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2">
          <Download size={14} />
          {busy ? 'Encrypting…' : 'Download encrypted file'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TaxReturnScreen**

Replace `src/screens/TaxReturnScreen.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Copy, FileDown, Check } from 'lucide-react'
import { ReturnSection } from '../components/taxreturn/ReturnSection'
import { ExportDialog } from '../components/taxreturn/ExportDialog'
import { AlertStrip } from '../components/ui/AlertStrip'
import { useTaxYear } from '../hooks/useTaxYear'
import { storage } from '../lib/storage'
import { getDataClient } from '../lib/github'
import { readShareLots } from '../lib/dataRepo'
import { buildTaxReturn } from '../lib/taxReturn'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { getTaxYearLabel } from '../lib/taxYears'
import type { ShareLot } from '../types'

export function TaxReturnScreen() {
  const profileId = storage.getActiveProfile()
  const { taxYear, loading } = useTaxYear(profileId)
  const [lots, setLots] = useState<ShareLot[]>([])
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) return
    const client = getDataClient(pat, repo)
    readShareLots(client, profileId).then(res => setLots(res?.data ?? [])).catch(() => setLots([]))
  }, [profileId])

  if (loading || !taxYear) return <div className="text-text-2 text-sm py-8">Loading your return…</div>

  const model = buildTaxReturn(taxYear, lots, R)

  const copyToClipboard = () => {
    const lines = model.sections.flatMap(s => [
      `## ${s.title}`,
      ...s.boxes.map(b => `${b.box !== '—' ? `Box ${b.box}: ` : ''}${b.label}: ${b.value == null ? '(needs input)' : `£${b.value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}`),
      '',
    ])
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Your Self Assessment</h1>
        <span className="font-mono text-xs text-text-2">{getTaxYearLabel(model.taxYear as `${number}-${number}`)}</span>
        <span className="ml-auto font-mono text-xs text-accent bg-accent-soft border border-accent/30 rounded-full px-3 py-1">
          {model.readyCount} of {model.totalSections} sections ready
        </span>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={copyToClipboard} className="flex items-center gap-2 bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm hover:border-accent/30 transition-colors">
          {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy all figures'}
        </button>
        <button onClick={() => setShowExport(true)} className="flex items-center gap-2 bg-accent text-bg font-semibold rounded-lg px-4 py-2 text-sm hover:opacity-90 transition-opacity">
          <FileDown size={14} />
          Export for accountant
        </button>
      </div>

      <AlertStrip variant="accent">
        These figures map to the boxes on the HMRC online Self Assessment form. Copy each number into the matching box — you never need to understand the tax rules behind them.
      </AlertStrip>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {model.sections.map(s => <ReturnSection key={s.code} section={s} />)}
      </div>

      {showExport && (
        <ExportDialog
          data={{ taxYear: model.taxYear, generatedFor: profileId, sections: model.sections }}
          filename={`taxtracker-${profileId}-${model.taxYear}.enc.json`}
          onClose={() => setShowExport(false)}
        />
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
git add src/components/taxreturn/ src/screens/TaxReturnScreen.tsx
git commit -m "feat: Tax Return screen — SA100/SA102/CGT summary, copy, encrypted export"
git push
```

---

## Self-review checklist

- ✅ Band classified on TOTAL income (employment + dividends + savings + benefits) — fixes Plan 3 review note
- ✅ SA102 (pay/tax/benefits), Dividends, Savings, CGT sections with HMRC box numbers + plain English
- ✅ Readiness only counts relevant sections (dividends section not "incomplete" if user has no dividends)
- ✅ Copy-to-clipboard produces plain-text figures
- ✅ Encrypted export uses AES-GCM + PBKDF2 (same crypto family as PIN hashing)
- ✅ Reuses summariseTaxYear, marginalBand, section104Pool, JargonTip, StatusDot, AlertStrip
- ✅ No emojis, Lucide icons only
