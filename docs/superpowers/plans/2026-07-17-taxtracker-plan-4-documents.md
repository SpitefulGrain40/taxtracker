# TaxTracker Plan 4: Documents Screen + P11D/P60 Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** A full Documents screen where users upload payslips, P11D, and P60 — each extracted by Claude, reviewed, and saved to the tax year data. Extends the existing `claude.ts` extraction module with P11D + P60 parsers.

**Architecture:** New extraction functions (`extractP11D`, `extractP60`) mirror the existing `extractPayslip` pattern in `src/lib/claude.ts`. A `DocumentsScreen` lists documents by type with status dots, an upload zone, and an AI-extraction review card that writes confirmed data into the current `TaxYear` via `useTaxYear().saveTaxYear`. Payslip uploads append to `employment[].payslips`; P11D populates `benefitsInKind`; P60 reconciles the year-end totals.

**Tech Stack:** React 18, TypeScript, Tailwind v4, Lucide React, Vitest. Reuses `claude.ts`, `useTaxYear`, `StatusDot`, `AlertStrip`.

---

## File structure

```
src/
├── lib/
│   ├── claude.ts             MODIFY — add extractP11D, extractP60 + parse helpers
│   └── claude.test.ts        MODIFY — add parse tests for P11D + P60
├── screens/
│   └── DocumentsScreen.tsx   REPLACE placeholder
└── components/
    └── documents/
        ├── UploadZone.tsx     NEW — drag/click file upload (extracted from StepPayslip pattern)
        ├── ExtractReview.tsx  NEW — generic review-and-confirm card for extracted fields
        └── DocumentList.tsx   NEW — list of docs by type with StatusDot
```

---

## Task 1: P11D + P60 extraction in claude.ts

**Files:**
- Modify: `src/lib/claude.ts`
- Modify: `src/lib/claude.test.ts`

- [ ] **Step 1: Add parse tests to claude.test.ts**

Append to `src/lib/claude.test.ts`:

```ts
import { parseP11DResponse, parseP60Response } from './claude'

describe('parseP11DResponse', () => {
  it('parses benefit line items', () => {
    const raw = JSON.stringify({
      taxYear: '2024-25',
      benefits: [
        { type: 'medical', description: 'Private medical insurance', taxableValue: 1450.00 },
        { type: 'car', description: 'Company car', taxableValue: 3200.00 },
      ],
    })
    const r = parseP11DResponse(raw)
    expect(r.taxYear).toBe('2024-25')
    expect(r.benefits).toHaveLength(2)
    expect(r.benefits[0].taxableValue).toBe(1450.00)
    expect(r.benefits[1].type).toBe('car')
  })
  it('handles empty benefits array', () => {
    const r = parseP11DResponse(JSON.stringify({ taxYear: '2024-25', benefits: [] }))
    expect(r.benefits).toEqual([])
  })
  it('throws on invalid JSON', () => {
    expect(() => parseP11DResponse('nope')).toThrow()
  })
})

describe('parseP60Response', () => {
  it('parses year-end totals', () => {
    const raw = JSON.stringify({
      taxYear: '2024-25',
      totalPay: 98000.00,
      totalTaxDeducted: 27500.00,
      totalEmployeeNI: 4100.00,
      employerName: 'SAP UK Limited',
      taxCode: 'K289',
    })
    const r = parseP60Response(raw)
    expect(r.totalPay).toBe(98000.00)
    expect(r.totalTaxDeducted).toBe(27500.00)
    expect(r.taxCode).toBe('K289')
  })
  it('throws when required numeric field missing', () => {
    expect(() => parseP60Response(JSON.stringify({ taxYear: '2024-25', employerName: 'X' }))).toThrow()
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd "C:/Users/I578036/Documents/TaxTracker"
npm run test -- claude.test.ts
```
Expected: FAIL (parseP11DResponse / parseP60Response undefined)

- [ ] **Step 3: Add to claude.ts**

Append these to `src/lib/claude.ts` (after the existing payslip code). Import `BenefitEntry` and `TaxYearKey` in the existing type import at the top of the file — add them to the `import type { ... } from '../types'` line.

```ts
// ─── P11D ─────────────────────────────────────────────────────────────────────

interface RawP11D {
  taxYear: string
  benefits: { type: string; description: string; taxableValue: number }[]
}

export function parseP11DResponse(jsonText: string): { taxYear: string; benefits: Omit<BenefitEntry, 'id' | 'taxYear' | 'sourceDocumentId'>[] } {
  const raw = JSON.parse(jsonText) as RawP11D
  if (!Array.isArray(raw.benefits)) throw new Error('P11D extraction: benefits is not an array')
  const validTypes = ['car', 'medical', 'loan', 'reimbursement', 'other']
  return {
    taxYear: raw.taxYear,
    benefits: raw.benefits.map(b => ({
      type: (validTypes.includes(b.type) ? b.type : 'other') as BenefitEntry['type'],
      description: b.description,
      taxableValue: b.taxableValue,
    })),
  }
}

const P11D_SYSTEM = `You are a UK P11D form extractor. Extract benefit-in-kind values exactly as printed. Return ONLY valid JSON, no prose.`
const P11D_SCHEMA = `{
  "taxYear": "YYYY-YY",
  "benefits": [{"type": "car|medical|loan|reimbursement|other", "description": string, "taxableValue": number}]
}`

export async function extractP11D(apiKey: string, fileBase64: string, mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp') {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system: P11D_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        mediaType === 'application/pdf'
          ? { type: 'document' as const, source: { type: 'base64' as const, media_type: mediaType, data: fileBase64 } }
          : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: fileBase64 } },
        { type: 'text' as const, text: `Extract all benefits in kind from this P11D. Categorise each into type (car/medical/loan/reimbursement/other). Note: employer reimbursements (e.g. IVF, relocation) are 'reimbursement' and are still taxable. Return JSON:\n${P11D_SCHEMA}` },
      ],
    }],
  })
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')
  if (response.stop_reason !== 'end_turn') throw new Error(`P11D extraction incomplete: ${response.stop_reason}`)
  let jsonText = textBlock.text.trim()
  if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return { ...parseP11DResponse(jsonText), rawExtracted: jsonText }
}

// ─── P60 ──────────────────────────────────────────────────────────────────────

interface RawP60 {
  taxYear: string
  totalPay: number
  totalTaxDeducted: number
  totalEmployeeNI: number
  employerName: string
  taxCode: string
}

export function parseP60Response(jsonText: string): RawP60 {
  const raw = JSON.parse(jsonText) as RawP60
  for (const f of ['totalPay', 'totalTaxDeducted', 'totalEmployeeNI'] as const) {
    if (typeof raw[f] !== 'number' || !Number.isFinite(raw[f])) throw new Error(`P60 extraction missing/invalid field: ${f}`)
  }
  return raw
}

const P60_SYSTEM = `You are a UK P60 end-of-year certificate extractor. Extract the year-end totals exactly as printed. Return ONLY valid JSON, no prose.`
const P60_SCHEMA = `{
  "taxYear": "YYYY-YY",
  "totalPay": number,
  "totalTaxDeducted": number,
  "totalEmployeeNI": number,
  "employerName": string,
  "taxCode": string
}`

export async function extractP60(apiKey: string, fileBase64: string, mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp') {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: P60_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        mediaType === 'application/pdf'
          ? { type: 'document' as const, source: { type: 'base64' as const, media_type: mediaType, data: fileBase64 } }
          : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: fileBase64 } },
        { type: 'text' as const, text: `Extract the P60 year-end totals. Return JSON:\n${P60_SCHEMA}` },
      ],
    }],
  })
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')
  if (response.stop_reason !== 'end_turn') throw new Error(`P60 extraction incomplete: ${response.stop_reason}`)
  let jsonText = textBlock.text.trim()
  if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return { ...parseP60Response(jsonText), rawExtracted: jsonText }
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- claude.test.ts
```
Expected: PASS (existing + 5 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts src/lib/claude.test.ts
git commit -m "feat: P11D and P60 Claude extraction"
```

---

## Task 2: UploadZone + ExtractReview + DocumentList components

**Files:**
- Create: `src/components/documents/UploadZone.tsx`
- Create: `src/components/documents/ExtractReview.tsx`
- Create: `src/components/documents/DocumentList.tsx`

- [ ] **Step 1: UploadZone**

Create `src/components/documents/UploadZone.tsx`:

```tsx
import { useRef } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  label: string
  hint?: string
  onFile: (file: File) => void
}

export function UploadZone({ label, hint, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }
  return (
    <>
      <div
        className="border-2 border-dashed border-accent/30 rounded-xl p-6 text-center cursor-pointer hover:border-accent/60 hover:bg-accent/5 transition-all"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        <Upload size={20} className="mx-auto text-accent mb-2" />
        <p className="text-sm font-medium text-accent">{label}</p>
        {hint && <p className="text-xs text-text-2 mt-1">{hint}</p>}
      </div>
      <input ref={inputRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </>
  )
}
```

- [ ] **Step 2: ExtractReview**

Create `src/components/documents/ExtractReview.tsx`:

```tsx
import { CheckCircle, ChevronRight } from 'lucide-react'

interface Field { label: string; value: string }

interface Props {
  title: string
  fields: Field[]
  onConfirm: () => void
  onCancel: () => void
}

export function ExtractReview({ title, fields, onConfirm, onCancel }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle size={16} className="text-green" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="bg-surface rounded-lg overflow-hidden border border-white/[0.06]">
        <div className="divide-y divide-white/[0.04]">
          {fields.map(f => (
            <div key={f.label} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-2">{f.label}</span>
              <span className="font-mono text-text-1">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onConfirm} className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          Looks right — save it
          <ChevronRight size={14} />
        </button>
        <button onClick={onCancel} className="px-4 border border-white/10 rounded-lg text-sm text-text-2 hover:text-text-1">Cancel</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: DocumentList**

Create `src/components/documents/DocumentList.tsx`:

```tsx
import { FileText, Table } from 'lucide-react'
import { StatusDot } from '../ui/StatusDot'

export interface DocItem {
  name: string
  meta: string
  status: 'green' | 'yellow' | 'gray'
  kind: 'pdf' | 'csv'
}

interface Props {
  items: DocItem[]
}

export function DocumentList({ items }: Props) {
  return (
    <div className="divide-y divide-white/[0.04]">
      {items.map((d, i) => (
        <div key={i} className={`flex items-center gap-3 px-5 py-3 ${d.status === 'gray' ? 'opacity-50' : ''}`}>
          <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${d.kind === 'csv' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
            {d.kind === 'csv' ? <Table size={15} /> : <FileText size={15} />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{d.name}</div>
            <div className="text-[11px] text-text-2 mt-0.5">{d.meta}</div>
          </div>
          <StatusDot status={d.status} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/documents/
git commit -m "feat: UploadZone, ExtractReview, DocumentList components"
```

---

## Task 3: DocumentsScreen

**Files:**
- Replace: `src/screens/DocumentsScreen.tsx`

- [ ] **Step 1: Implement DocumentsScreen**

Replace `src/screens/DocumentsScreen.tsx`:

```tsx
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { UploadZone } from '../components/documents/UploadZone'
import { ExtractReview } from '../components/documents/ExtractReview'
import { DocumentList, type DocItem } from '../components/documents/DocumentList'
import { AlertStrip } from '../components/ui/AlertStrip'
import { useTaxYear } from '../hooks/useTaxYear'
import { storage } from '../lib/storage'
import { extractPayslip, extractP11D, extractP60 } from '../lib/claude'
import { getCurrentTaxYear, getTaxYearKey, getTaxPeriod } from '../lib/taxYears'
import type { TaxYear, Payslip, BenefitEntry } from '../types'

type DocType = 'payslip' | 'p11d' | 'p60'
type State = 'idle' | 'extracting' | 'review' | 'error'

async function fileToBase64(file: File): Promise<{ base64: string; mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' }> {
  const buffer = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  const mediaType = file.type === 'application/pdf' ? 'application/pdf'
    : file.type === 'image/png' ? 'image/png'
    : file.type === 'image/webp' ? 'image/webp'
    : 'image/jpeg'
  return { base64, mediaType }
}

export function DocumentsScreen() {
  const profileId = storage.getActiveProfile()
  const { taxYear, saveTaxYear, loading } = useTaxYear(profileId)

  const [docType, setDocType] = useState<DocType>('payslip')
  const [state, setState] = useState<State>('idle')
  const [reviewFields, setReviewFields] = useState<{ label: string; value: string }[]>([])
  const [pendingApply, setPendingApply] = useState<((ty: TaxYear) => TaxYear) | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  if (loading || !taxYear) return <div className="text-text-2 text-sm py-8">Loading documents…</div>

  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleFile = async (file: File) => {
    const apiKey = storage.getClaudeKey()
    if (!apiKey) { setErrorMsg('Claude API key not found — check setup.'); setState('error'); return }
    setState('extracting')
    try {
      const { base64, mediaType } = await fileToBase64(file)

      if (docType === 'payslip') {
        const r = await extractPayslip(apiKey, base64, mediaType)
        setReviewFields([
          { label: 'Employer', value: r.employerName },
          { label: 'Basic Salary', value: gbp(r.basicSalary) },
          { label: 'Tax Paid', value: gbp(r.taxPaid) },
          { label: 'YTD Gross', value: gbp(r.ytdGross) },
          { label: 'Tax Code', value: r.taxCode },
        ])
        setPendingApply(() => (ty: TaxYear): TaxYear => {
          const payDate = new Date(r.date)
          const payslip: Payslip = {
            ...r, id: crypto.randomUUID(),
            taxPeriod: getTaxPeriod(payDate),
            taxYear: getTaxYearKey(payDate),
          }
          const emp = ty.employment.find(e => e.employerName === r.employerName)
          if (emp) emp.payslips.push(payslip)
          else ty.employment.push({ id: crypto.randomUUID(), employerName: r.employerName, payslips: [payslip] })
          return { ...ty }
        })
      } else if (docType === 'p11d') {
        const r = await extractP11D(apiKey, base64, mediaType)
        setReviewFields(r.benefits.map(b => ({ label: b.description, value: gbp(b.taxableValue) })))
        setPendingApply(() => (ty: TaxYear): TaxYear => {
          const entries: BenefitEntry[] = r.benefits.map(b => ({
            ...b, id: crypto.randomUUID(), taxYear: ty.key,
          }))
          return { ...ty, benefitsInKind: [...ty.benefitsInKind, ...entries] }
        })
      } else {
        const r = await extractP60(apiKey, base64, mediaType)
        setReviewFields([
          { label: 'Employer', value: r.employerName },
          { label: 'Total Pay', value: gbp(r.totalPay) },
          { label: 'Total Tax', value: gbp(r.totalTaxDeducted) },
          { label: 'Total NI', value: gbp(r.totalEmployeeNI) },
          { label: 'Tax Code', value: r.taxCode },
        ])
        // P60 is a year-end reconciliation — recorded as a single synthetic period-12 payslip
        setPendingApply(() => (ty: TaxYear): TaxYear => {
          const payslip: Payslip = {
            id: crypto.randomUUID(), taxPeriod: 12, taxYear: ty.key, date: ty.endDate,
            basicSalary: 0, carAllowance: 0, otherPayments: [], taxPaid: 0, employeeNI: 0,
            salarySacrifice: [], esppContribution: 0, employerMatch: 0,
            ytdGross: r.totalPay, ytdTaxPaid: r.totalTaxDeducted, ytdEmployeeNI: r.totalEmployeeNI,
            taxCode: r.taxCode, niNumber: '', employerName: r.employerName,
            rawExtracted: { p60: r.rawExtracted },
          }
          const emp = ty.employment.find(e => e.employerName === r.employerName)
          if (emp) emp.payslips.push(payslip)
          else ty.employment.push({ id: crypto.randomUUID(), employerName: r.employerName, payslips: [payslip] })
          return { ...ty }
        })
      }
      setState('review')
    } catch (e) {
      setErrorMsg(String(e)); setState('error')
    }
  }

  const confirm = async () => {
    if (!pendingApply) return
    setState('extracting')
    try {
      await saveTaxYear(pendingApply(taxYear))
      setState('idle'); setPendingApply(null); setReviewFields([])
    } catch (e) {
      setErrorMsg(String(e)); setState('error')
    }
  }

  // Build the document list from current tax year data
  const payslipCount = taxYear.employment.flatMap(e => e.payslips).filter(p => p.taxPeriod < 12).length
  const hasP60 = taxYear.employment.flatMap(e => e.payslips).some(p => p.taxPeriod === 12)
  const benefitCount = taxYear.benefitsInKind.length
  const docs: DocItem[] = [
    { name: 'Payslips', meta: payslipCount ? `${payslipCount} uploaded` : 'None yet', status: payslipCount ? 'green' : 'gray', kind: 'pdf' },
    { name: 'P11D (benefits)', meta: benefitCount ? `${benefitCount} benefits` : 'Not uploaded', status: benefitCount ? 'green' : 'gray', kind: 'pdf' },
    { name: 'P60 (year-end)', meta: hasP60 ? 'Recorded' : 'Not uploaded', status: hasP60 ? 'green' : 'gray', kind: 'pdf' },
  ]

  const typeLabels: Record<DocType, string> = { payslip: 'payslip', p11d: 'P11D', p60: 'P60' }

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Documents</h1>
        <span className="font-mono text-xs text-text-2">{getCurrentTaxYear()}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Upload panel */}
        <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
          {state === 'extracting' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-text-2 text-sm">Reading your {typeLabels[docType]}…</p>
            </div>
          )}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red/10 border border-red/20">
                <AlertCircle size={16} className="text-red mt-0.5 flex-shrink-0" />
                <p className="text-sm">{errorMsg}</p>
              </div>
              <button onClick={() => setState('idle')} className="text-accent text-sm">Try again</button>
            </div>
          )}
          {state === 'review' && (
            <ExtractReview title={`${typeLabels[docType]} read — check the values`} fields={reviewFields} onConfirm={confirm} onCancel={() => { setState('idle'); setPendingApply(null) }} />
          )}
          {state === 'idle' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['payslip', 'p11d', 'p60'] as DocType[]).map(t => (
                  <button key={t} onClick={() => setDocType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${docType === t ? 'bg-accent text-bg' : 'bg-surface-2 text-text-2 hover:text-text-1'}`}>
                    {t === 'payslip' ? 'Payslip' : t === 'p11d' ? 'P11D' : 'P60'}
                  </button>
                ))}
              </div>
              <UploadZone
                label={`Upload a ${typeLabels[docType]}`}
                hint="PDF or photo — AI reads it for you"
                onFile={handleFile}
              />
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-serif text-base">This tax year</h2>
          </div>
          <DocumentList items={docs} />
        </div>
      </div>

      {!hasP60 && payslipCount > 0 && (
        <div className="mt-6">
          <AlertStrip variant="accent">
            Upload your <strong>P60</strong> at year end to confirm your final figures, or your <strong>P11D</strong> if you have benefits like medical insurance.
          </AlertStrip>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check, tests, build**

```bash
npx tsc --noEmit && npm run test 2>&1 | tail -4 && npm run build 2>&1 | tail -3
```
Expected: clean TS, all tests pass, build succeeds

- [ ] **Step 3: Commit + push**

```bash
git add src/screens/DocumentsScreen.tsx
git commit -m "feat: Documents screen — upload/extract payslips, P11D, P60"
git push
```

---

## Self-review checklist

- ✅ P11D extraction categorises benefits incl. reimbursements (IVF etc.) — per spec
- ✅ P60 recorded as synthetic period-12 payslip so it flows into `summariseTaxYear`'s latest-payslip logic (period 12 wins)
- ✅ Payslip upload appends to existing employer or creates new one
- ✅ Uses `getTaxPeriod`/`getTaxYearKey` to slot payslips correctly
- ✅ Reuses `useTaxYear().saveTaxYear`, StatusDot, AlertStrip — no data-layer duplication
- ✅ No emojis, Lucide icons only
- ⚠️ Note for Plan 6: P60 as period-12 payslip means `summariseTaxYear` will prefer it over earlier payslips — correct for year-end, but if a mid-year payslip is uploaded after a P60 the period-12 still wins (acceptable; P60 is authoritative)
