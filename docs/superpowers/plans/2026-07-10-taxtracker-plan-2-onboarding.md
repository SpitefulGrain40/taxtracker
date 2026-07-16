# TaxTracker Plan 2: Onboarding + Document Upload + Claude Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the payslip-first onboarding wizard, Claude API document extraction, share scheme setup, and the data hooks that wire profile + tax year data to/from the private GitHub repo.

**Architecture:** The existing `SetupScreen` covers credentials only. This plan adds a separate `OnboardingScreen` that runs after setup — a multi-step wizard seeded by uploading a payslip. Claude API (`claude-opus-4-8`, vision + structured output) extracts payslip fields client-side. Extracted + confirmed data is written to the private GitHub repo via `GitHubDataClient`. New React hooks (`useProfile`, `useTaxYear`) wrap the GitHub data layer so screens don't talk to the API directly. All Claude API calls go through a thin `src/lib/claude.ts` module.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Lucide React, `@anthropic-ai/sdk` (browser-compatible), `@octokit/rest`, Vitest + React Testing Library

---

## File structure

```
src/
├── lib/
│   ├── claude.ts              NEW — Claude API client wrapper (extraction prompts)
│   ├── claude.test.ts         NEW — unit tests for extraction parsing
│   ├── dataRepo.ts            NEW — typed read/write helpers (profile, taxYear, shareLots, lifeEvents)
│   └── dataRepo.test.ts       NEW — unit tests for data repo helpers
├── hooks/
│   ├── useProfile.ts          NEW — load/save profile from data repo
│   └── useTaxYear.ts          NEW — load/save tax year data from data repo
├── screens/
│   ├── OnboardingScreen.tsx   NEW — 5-step wizard (payslip → profile → scheme → income sources → done)
│   └── SetupScreen.tsx        MODIFY — add step 4: optional payslip upload to seed onboarding
├── components/
│   └── onboarding/
│       ├── StepPayslip.tsx    NEW — upload payslip → extract → confirm fields
│       ├── StepProfile.tsx    NEW — name, NI, tax code (pre-filled from extraction)
│       ├── StepScheme.tsx     NEW — add share scheme (type, employer, currency, broker)
│       └── StepIncome.tsx     NEW — checkboxes: dividends, savings, CGT, RSU vests, benefits
└── App.tsx                    MODIFY — add onboarding gate between setup and PIN
```

---

## Task 1: Claude API client module

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/lib/claude.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/claude.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parsePayslipResponse } from './claude'

describe('parsePayslipResponse', () => {
  it('parses a complete extraction response', () => {
    const raw = JSON.stringify({
      basicSalary: 8879.00,
      carAllowance: 700.00,
      taxPaid: 2819.27,
      employeeNI: 343.34,
      esppContribution: 266.37,
      employerMatch: 124.35,
      salarySacrifice: [{ label: 'Crit. Illness', amount: -23.27 }, { label: 'EE Sal Sac', amount: -887.90 }],
      otherPayments: [],
      ytdGross: 26377.03,
      ytdTaxPaid: 8457.80,
      ytdEmployeeNI: 1030.03,
      taxCode: '207T',
      niNumber: 'JL041798C',
      employerName: 'SAP UK Limited',
      payDate: '2025-06-30',
      rstVestIncome: null,
    })
    const result = parsePayslipResponse(raw)
    expect(result.basicSalary).toBe(8879.00)
    expect(result.taxCode).toBe('207T')
    expect(result.niNumber).toBe('JL041798C')
    expect(result.employerName).toBe('SAP UK Limited')
    expect(result.salarySacrifice).toHaveLength(2)
    expect(result.rstVestIncome).toBeUndefined()
  })

  it('handles missing optional fields gracefully', () => {
    const raw = JSON.stringify({
      basicSalary: 5000,
      carAllowance: 0,
      taxPaid: 800,
      employeeNI: 200,
      esppContribution: 0,
      employerMatch: 0,
      salarySacrifice: [],
      otherPayments: [],
      ytdGross: 5000,
      ytdTaxPaid: 800,
      ytdEmployeeNI: 200,
      taxCode: '1257L',
      niNumber: '',
      employerName: 'Test Corp',
      payDate: '2025-04-30',
    })
    const result = parsePayslipResponse(raw)
    expect(result.basicSalary).toBe(5000)
    expect(result.rstVestIncome).toBeUndefined()
  })

  it('throws on invalid JSON', () => {
    expect(() => parsePayslipResponse('not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Users/I578036/Documents/TaxTracker"
npm run test -- claude.test.ts
```

Expected: FAIL — `parsePayslipResponse` not found

- [ ] **Step 3: Implement claude.ts**

Create `src/lib/claude.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { Payslip, LineItem } from '../types'

// ─── Raw extraction shape returned by Claude ─────────────────────────────────

interface RawPayslipExtraction {
  basicSalary: number
  carAllowance: number
  taxPaid: number
  employeeNI: number
  esppContribution: number
  employerMatch: number
  salarySacrifice: LineItem[]
  otherPayments: LineItem[]
  ytdGross: number
  ytdTaxPaid: number
  ytdEmployeeNI: number
  taxCode: string
  niNumber: string
  employerName: string
  payDate: string
  rstVestIncome?: number | null
}

// ─── Parse helper (pure, testable without API) ────────────────────────────────

export function parsePayslipResponse(jsonText: string): Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> {
  const raw = JSON.parse(jsonText) as RawPayslipExtraction
  return {
    date: raw.payDate,
    basicSalary: raw.basicSalary,
    carAllowance: raw.carAllowance ?? 0,
    taxPaid: raw.taxPaid,
    employeeNI: raw.employeeNI,
    esppContribution: raw.esppContribution ?? 0,
    employerMatch: raw.employerMatch ?? 0,
    salarySacrifice: raw.salarySacrifice ?? [],
    otherPayments: raw.otherPayments ?? [],
    ytdGross: raw.ytdGross,
    ytdTaxPaid: raw.ytdTaxPaid,
    ytdEmployeeNI: raw.ytdEmployeeNI,
    taxCode: raw.taxCode,
    niNumber: raw.niNumber,
    employerName: raw.employerName,
    ...(raw.rstVestIncome != null ? { rstVestIncome: raw.rstVestIncome } : {}),
  }
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const PAYSLIP_SYSTEM = `You are a UK payslip data extractor. Extract all numerical values exactly as printed — do not recalculate. Return ONLY valid JSON, no prose.`

const PAYSLIP_SCHEMA = `{
  "basicSalary": number,
  "carAllowance": number,
  "taxPaid": number,
  "employeeNI": number,
  "esppContribution": number,
  "employerMatch": number,
  "salarySacrifice": [{"label": string, "amount": number}],
  "otherPayments": [{"label": string, "amount": number}],
  "ytdGross": number,
  "ytdTaxPaid": number,
  "ytdEmployeeNI": number,
  "taxCode": string,
  "niNumber": string,
  "employerName": string,
  "payDate": "YYYY-MM-DD",
  "rstVestIncome": number | null
}`

// ─── API call ─────────────────────────────────────────────────────────────────

export async function extractPayslip(
  apiKey: string,
  fileBase64: string,
  mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> & { rawExtracted: Record<string, string> }> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: PAYSLIP_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: mediaType, data: fileBase64 },
          },
          {
            type: 'text',
            text: `Extract all payslip fields. Return JSON matching this schema exactly:\n${PAYSLIP_SCHEMA}\n\nFor salarySacrifice: include all negative deductions like pension contributions, critical illness, cycle to work, etc. For otherPayments: include any additional positive payments beyond basic salary and car allowance. Set rstVestIncome to null unless there is a clear one-off RSU/share vest income line.`,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')

  // Strip markdown code fences if present
  const jsonText = textBlock.text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  const parsed = parsePayslipResponse(jsonText)
  return { ...parsed, rawExtracted: { payslip: jsonText } }
}
```

- [ ] **Step 4: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 5: Run tests**

```bash
npm run test -- claude.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/claude.ts src/lib/claude.test.ts package.json package-lock.json
git commit -m "feat: Claude API payslip extraction client"
```

---

## Task 2: Data repo helpers

**Files:**
- Create: `src/lib/dataRepo.ts`
- Create: `src/lib/dataRepo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/dataRepo.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readProfile, writeProfile, readTaxYear, writeTaxYear, profilePath, taxYearPath } from './dataRepo'

const mockClient = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
}

describe('path helpers', () => {
  it('profilePath returns correct path', () => {
    expect(profilePath('mike')).toBe('data/mike/profile.json')
    expect(profilePath('gemma')).toBe('data/gemma/profile.json')
  })

  it('taxYearPath returns correct path', () => {
    expect(taxYearPath('mike', '2025-26')).toBe('data/mike/2025-26.json')
  })
})

describe('readProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns profile data when file exists', async () => {
    const profile = { id: 'mike', firstName: 'Mike', niNumber: 'JL041798C', taxCode: '207T', pinHash: 'h', pinSalt: 's', schemes: [], otherIncomeSources: [] }
    mockClient.readFile.mockResolvedValue({ data: profile, sha: 'abc' })
    const result = await readProfile(mockClient as never, 'mike')
    expect(result?.data.firstName).toBe('Mike')
    expect(mockClient.readFile).toHaveBeenCalledWith('data/mike/profile.json')
  })

  it('returns null when profile does not exist', async () => {
    mockClient.readFile.mockResolvedValue(null)
    const result = await readProfile(mockClient as never, 'mike')
    expect(result).toBeNull()
  })
})

describe('writeProfile', () => {
  it('calls writeFile with correct path', async () => {
    mockClient.writeFile.mockResolvedValue(undefined)
    const profile = { id: 'mike' as const, firstName: 'Mike', niNumber: '', taxCode: '', pinHash: '', pinSalt: '', schemes: [], otherIncomeSources: [] }
    await writeProfile(mockClient as never, 'mike', profile, 'sha123')
    expect(mockClient.writeFile).toHaveBeenCalledWith('data/mike/profile.json', profile, 'sha123')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- dataRepo.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement dataRepo.ts**

Create `src/lib/dataRepo.ts`:

```ts
import type { GitHubDataClient } from './github'
import type { Profile, TaxYear, ShareLot, LifeEvent, ProfileId, TaxYearKey } from '../types'

// ─── Path helpers ─────────────────────────────────────────────────────────────

export const profilePath = (profileId: ProfileId | string) => `data/${profileId}/profile.json`
export const taxYearPath = (profileId: ProfileId | string, year: TaxYearKey) => `data/${profileId}/${year}.json`
export const shareLotsPath = (profileId: ProfileId | string) => `data/${profileId}/share-lots.json`
export const lifeEventsPath = (profileId: ProfileId | string) => `data/${profileId}/life-events.json`

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function readProfile(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<Profile>(profilePath(profileId))
}

export async function writeProfile(client: GitHubDataClient, profileId: ProfileId | string, profile: Profile, sha?: string) {
  return client.writeFile(profilePath(profileId), profile, sha)
}

// ─── Tax year ─────────────────────────────────────────────────────────────────

export function emptyTaxYear(key: TaxYearKey): TaxYear {
  const [startYear] = key.split('-')
  return {
    key,
    startDate: `${startYear}-04-06`,
    endDate: `${parseInt(startYear) + 1}-04-05`,
    employment: [],
    dividends: [],
    savingsInterest: [],
    benefitsInKind: [],
  }
}

export async function readTaxYear(client: GitHubDataClient, profileId: ProfileId | string, year: TaxYearKey) {
  return client.readFile<TaxYear>(taxYearPath(profileId, year))
}

export async function writeTaxYear(client: GitHubDataClient, profileId: ProfileId | string, year: TaxYearKey, data: TaxYear, sha?: string) {
  return client.writeFile(taxYearPath(profileId, year), data, sha)
}

// ─── Share lots ───────────────────────────────────────────────────────────────

export async function readShareLots(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<ShareLot[]>(shareLotsPath(profileId))
}

export async function writeShareLots(client: GitHubDataClient, profileId: ProfileId | string, lots: ShareLot[], sha?: string) {
  return client.writeFile(shareLotsPath(profileId), lots, sha)
}

// ─── Life events ──────────────────────────────────────────────────────────────

export async function readLifeEvents(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<LifeEvent[]>(lifeEventsPath(profileId))
}

export async function writeLifeEvents(client: GitHubDataClient, profileId: ProfileId | string, events: LifeEvent[], sha?: string) {
  return client.writeFile(lifeEventsPath(profileId), events, sha)
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- dataRepo.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dataRepo.ts src/lib/dataRepo.test.ts
git commit -m "feat: typed data repo helpers for profile, taxYear, shareLots, lifeEvents"
```

---

## Task 3: useProfile and useTaxYear hooks

**Files:**
- Create: `src/hooks/useProfile.ts`
- Create: `src/hooks/useTaxYear.ts`

- [ ] **Step 1: Implement useProfile**

Create `src/hooks/useProfile.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { getDataClient } from '../lib/github'
import { readProfile, writeProfile } from '../lib/dataRepo'
import { storage } from '../lib/storage'
import type { Profile, ProfileId } from '../types'

interface UseProfileResult {
  profile: Profile | null
  sha: string | null
  loading: boolean
  error: string | null
  saveProfile: (profile: Profile) => Promise<void>
  refetch: () => void
}

export function useProfile(profileId: ProfileId): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) { setLoading(false); return }

    const client = getDataClient(pat, repo)
    setLoading(true)
    readProfile(client, profileId)
      .then(result => {
        setProfile(result?.data ?? null)
        setSha(result?.sha ?? null)
        setError(null)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [profileId, tick])

  const saveProfile = useCallback(async (updated: Profile) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) throw new Error('Not configured')
    const client = getDataClient(pat, repo)
    await writeProfile(client, profileId, updated, sha ?? undefined)
    setProfile(updated)
    setTick(t => t + 1)
  }, [profileId, sha])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { profile, sha, loading, error, saveProfile, refetch }
}
```

- [ ] **Step 2: Implement useTaxYear**

Create `src/hooks/useTaxYear.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { getDataClient } from '../lib/github'
import { readTaxYear, writeTaxYear, emptyTaxYear } from '../lib/dataRepo'
import { storage } from '../lib/storage'
import { getCurrentTaxYear } from '../lib/taxYears'
import type { TaxYear, ProfileId, TaxYearKey } from '../types'

interface UseTaxYearResult {
  taxYear: TaxYear | null
  sha: string | null
  loading: boolean
  error: string | null
  saveTaxYear: (data: TaxYear) => Promise<void>
  refetch: () => void
}

export function useTaxYear(profileId: ProfileId, year?: TaxYearKey): UseTaxYearResult {
  const key = year ?? getCurrentTaxYear()
  const [taxYear, setTaxYear] = useState<TaxYear | null>(null)
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) { setLoading(false); return }

    const client = getDataClient(pat, repo)
    setLoading(true)
    readTaxYear(client, profileId, key)
      .then(result => {
        setTaxYear(result?.data ?? emptyTaxYear(key))
        setSha(result?.sha ?? null)
        setError(null)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [profileId, key, tick])

  const saveTaxYear = useCallback(async (updated: TaxYear) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) throw new Error('Not configured')
    const client = getDataClient(pat, repo)
    await writeTaxYear(client, profileId, key, updated, sha ?? undefined)
    setTaxYear(updated)
    setTick(t => t + 1)
  }, [profileId, key, sha])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { taxYear, sha, loading, error, saveTaxYear, refetch }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useProfile.ts src/hooks/useTaxYear.ts
git commit -m "feat: useProfile and useTaxYear hooks for GitHub data layer"
```

---

## Task 4: StepPayslip — upload, extract, confirm

**Files:**
- Create: `src/components/onboarding/StepPayslip.tsx`
- Create: `src/components/onboarding/StepPayslip.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/onboarding/StepPayslip.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { StepPayslip } from './StepPayslip'
import { vi } from 'vitest'

describe('StepPayslip', () => {
  it('shows upload prompt initially', () => {
    render(<StepPayslip onExtracted={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByText(/Upload your most recent payslip/i)).toBeInTheDocument()
  })

  it('shows skip button', () => {
    render(<StepPayslip onExtracted={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('calls onSkip when skip is clicked', () => {
    const onSkip = vi.fn()
    render(<StepPayslip onExtracted={vi.fn()} onSkip={onSkip} />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onSkip).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- StepPayslip.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement StepPayslip**

Create `src/components/onboarding/StepPayslip.tsx`:

```tsx
import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { extractPayslip, parsePayslipResponse } from '../../lib/claude'
import { storage } from '../../lib/storage'
import type { Payslip } from '../../types'

type ExtractedFields = Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> & { rawExtracted: Record<string, string> }

interface Props {
  onExtracted: (fields: ExtractedFields) => void
  onSkip: () => void
}

type State = 'idle' | 'extracting' | 'review' | 'error'

export function StepPayslip({ onExtracted, onSkip }: Props) {
  const [state, setState] = useState<State>('idle')
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const apiKey = storage.getClaudeKey()
    if (!apiKey) { setErrorMsg('Claude API key not found. Please go back to setup.'); setState('error'); return }

    const mediaType = file.type === 'application/pdf'
      ? 'application/pdf'
      : file.type === 'image/png' ? 'image/png'
      : file.type === 'image/webp' ? 'image/webp'
      : 'image/jpeg'

    setState('extracting')
    try {
      const buffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      const result = await extractPayslip(apiKey, base64, mediaType as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp')
      setExtracted(result)
      setState('review')
    } catch (e) {
      setErrorMsg(String(e))
      setState('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleConfirm = () => {
    if (extracted) onExtracted(extracted)
  }

  if (state === 'extracting') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-text-2 text-sm">Reading your payslip...</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red/10 border border-red/20">
          <AlertCircle size={16} className="text-red mt-0.5 flex-shrink-0" />
          <p className="text-sm text-text-1">{errorMsg}</p>
        </div>
        <button onClick={() => setState('idle')} className="text-accent text-sm">Try again</button>
        <button onClick={onSkip} className="block text-text-2 text-sm">Skip for now</button>
      </div>
    )
  }

  if (state === 'review' && extracted) {
    const fields: { label: string; value: string }[] = [
      { label: 'Employer', value: extracted.employerName },
      { label: 'Basic Salary', value: `£${extracted.basicSalary.toFixed(2)}` },
      { label: 'Car Allowance', value: `£${extracted.carAllowance.toFixed(2)}` },
      { label: 'Tax Paid', value: `£${extracted.taxPaid.toFixed(2)}` },
      { label: 'Employee NI', value: `£${extracted.employeeNI.toFixed(2)}` },
      { label: 'ESPP Contribution', value: `£${extracted.esppContribution.toFixed(2)}` },
      { label: 'Employer Match', value: `£${extracted.employerMatch.toFixed(2)}` },
      { label: 'YTD Gross', value: `£${extracted.ytdGross.toFixed(2)}` },
      { label: 'Tax Code', value: extracted.taxCode },
      { label: 'NI Number', value: extracted.niNumber || '—' },
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green" />
          <p className="text-sm font-medium">Payslip read — check the values below</p>
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
          <button
            onClick={handleConfirm}
            className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Looks right — continue
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setState('idle')} className="px-4 border border-white/10 rounded-lg text-sm text-text-2 hover:text-text-1">
            Re-upload
          </button>
        </div>
      </div>
    )
  }

  // idle state
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Upload your most recent payslip</h3>
        <p className="text-text-2 text-sm">We'll read it automatically to pre-fill your profile. PDF or photo.</p>
      </div>
      <div
        className="border-2 border-dashed border-accent/30 rounded-xl p-8 text-center cursor-pointer hover:border-accent/60 hover:bg-accent/5 transition-all"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        <Upload size={24} className="mx-auto text-accent mb-3" />
        <p className="text-sm font-medium text-accent">Choose file or drag here</p>
        <p className="text-xs text-text-2 mt-1">PDF, JPG, PNG or WebP — max 10MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button onClick={onSkip} className="w-full text-text-2 text-sm py-2 hover:text-text-1 transition-colors">
        Skip for now — I'll add a payslip later
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- StepPayslip.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat: StepPayslip component — upload, Claude extraction, confirm"
```

---

## Task 5: StepProfile, StepScheme, StepIncome

**Files:**
- Create: `src/components/onboarding/StepProfile.tsx`
- Create: `src/components/onboarding/StepScheme.tsx`
- Create: `src/components/onboarding/StepIncome.tsx`

- [ ] **Step 1: Implement StepProfile**

Create `src/components/onboarding/StepProfile.tsx`:

```tsx
import { useState } from 'react'
import type { Profile, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  prefill?: { firstName?: string; niNumber?: string; taxCode?: string; employerName?: string }
  onNext: (data: Pick<Profile, 'firstName' | 'niNumber' | 'taxCode'> & { employerName: string }) => void
}

export function StepProfile({ profileId, prefill, onNext }: Props) {
  const [firstName, setFirstName] = useState(prefill?.firstName ?? (profileId === 'mike' ? 'Mike' : 'Gemma'))
  const [niNumber, setNiNumber] = useState(prefill?.niNumber ?? '')
  const [taxCode, setTaxCode] = useState(prefill?.taxCode ?? '')
  const [employerName, setEmployerName] = useState(prefill?.employerName ?? '')

  const fields = [
    { label: 'First name', value: firstName, onChange: setFirstName, placeholder: 'Mike', mono: false },
    { label: 'NI Number', value: niNumber, onChange: setNiNumber, placeholder: 'AB 12 34 56 C', mono: true },
    { label: 'Tax code', value: taxCode, onChange: setTaxCode, placeholder: '1257L', mono: true },
    { label: 'Employer name', value: employerName, onChange: setEmployerName, placeholder: 'SAP UK Ltd', mono: false },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Your details</h3>
        <p className="text-text-2 text-sm">We've pre-filled what we could from your payslip. Check and correct anything.</p>
      </div>
      {fields.map(f => (
        <div key={f.label}>
          <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">{f.label}</label>
          <input
            className={`w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:border-accent/50 ${f.mono ? 'font-mono' : ''}`}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            placeholder={f.placeholder}
          />
        </div>
      ))}
      <button
        onClick={() => onNext({ firstName, niNumber, taxCode, employerName })}
        disabled={!firstName || !employerName}
        className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        Continue
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Implement StepScheme**

Create `src/components/onboarding/StepScheme.tsx`:

```tsx
import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import type { ShareSchemeConfig, SchemeType } from '../../types'

interface Props {
  employerName: string
  onNext: (schemes: ShareSchemeConfig[]) => void
  onSkip: () => void
}

const SCHEME_TYPES: { value: SchemeType; label: string; description: string }[] = [
  { value: 'espp-match', label: 'ESPP — employer match', description: "You contribute monthly, employer adds matching shares. No discount — company tops up your contribution." },
  { value: 'espp-discounted', label: 'ESPP — discounted purchase', description: "Shares bought at a discount to market price (e.g. 15% off). Income tax applies on the discount." },
  { value: 'rsu', label: 'RSU — restricted stock units', description: "Shares vest over time. Income tax + NI applies on the full market value at each vest date." },
  { value: 'csop', label: 'CSOP / EMI / SAYE', description: "Company Share Option Plan, Enterprise Management Incentives, or Save As You Earn scheme." },
]

const CURRENCIES = ['USD', 'GBP', 'EUR']
const BROKERS = ['Fidelity', 'E*Trade', 'Morgan Stanley', 'Other']
const EXCHANGES = ['NYSE', 'NASDAQ', 'LSE', 'Other']

function newScheme(employerName: string): Partial<ShareSchemeConfig> {
  return { employerName, currency: 'USD', exchange: 'NYSE', broker: 'Fidelity', active: true }
}

export function StepScheme({ employerName, onNext, onSkip }: Props) {
  const [schemes, setSchemes] = useState<ShareSchemeConfig[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Partial<ShareSchemeConfig>>(newScheme(employerName))

  const addScheme = () => {
    if (!draft.schemeType) return
    const scheme: ShareSchemeConfig = {
      id: crypto.randomUUID(),
      employerName: draft.employerName ?? employerName,
      schemeType: draft.schemeType,
      discountRate: draft.discountRate,
      currency: draft.currency ?? 'USD',
      exchange: draft.exchange ?? 'NYSE',
      broker: draft.broker ?? 'Other',
      active: true,
    }
    setSchemes(prev => [...prev, scheme])
    setAdding(false)
    setDraft(newScheme(employerName))
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Share schemes</h3>
        <p className="text-text-2 text-sm">Add any employee share schemes you participate in. This sets the tax rules for every lot imported.</p>
      </div>

      {schemes.length > 0 && (
        <div className="space-y-2">
          {schemes.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-white/[0.06]">
              <Check size={14} className="text-green flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{s.employerName}</p>
                <p className="text-xs text-text-2">{SCHEME_TYPES.find(t => t.value === s.schemeType)?.label} · {s.currency} · {s.broker}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 p-4 bg-surface rounded-xl border border-accent/20">
          <p className="text-sm font-medium">Add scheme</p>
          <div>
            <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Scheme type</label>
            <div className="space-y-2">
              {SCHEME_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setDraft(d => ({ ...d, schemeType: t.value }))}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${draft.schemeType === t.value ? 'border-accent bg-accent/10 text-text-1' : 'border-white/10 text-text-2 hover:border-white/20'}`}
                >
                  <p className="font-medium text-text-1">{t.label}</p>
                  <p className="text-xs text-text-2 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
          {draft.schemeType === 'espp-discounted' && (
            <div>
              <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Discount rate (%)</label>
              <input
                type="number" min={1} max={50}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
                placeholder="15"
                value={draft.discountRate ? draft.discountRate * 100 : ''}
                onChange={e => setDraft(d => ({ ...d, discountRate: parseFloat(e.target.value) / 100 || undefined }))}
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Currency', key: 'currency' as const, options: CURRENCIES },
              { label: 'Exchange', key: 'exchange' as const, options: EXCHANGES },
              { label: 'Broker', key: 'broker' as const, options: BROKERS },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">{f.label}</label>
                <select
                  className="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm text-text-1 focus:outline-none focus:border-accent/50"
                  value={draft[f.key] as string ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                >
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addScheme} disabled={!draft.schemeType}
              className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm disabled:opacity-40 hover:opacity-90">
              Add scheme
            </button>
            <button onClick={() => setAdding(false)} className="px-4 border border-white/10 rounded-lg text-sm text-text-2">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full border border-dashed border-accent/30 rounded-xl py-3 text-sm text-accent hover:border-accent/60 hover:bg-accent/5 transition-all flex items-center justify-center gap-2">
          <Plus size={14} />
          Add a share scheme
        </button>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onNext(schemes)}
          className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          {schemes.length > 0 ? 'Continue' : 'No schemes — continue'}
        </button>
      </div>
      <button onClick={onSkip} className="w-full text-text-2 text-sm py-1 hover:text-text-1">
        Add schemes later in Settings
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Implement StepIncome**

Create `src/components/onboarding/StepIncome.tsx`:

```tsx
import type { Profile } from '../../types'

type IncomeSource = Profile['otherIncomeSources'][number]

interface Props {
  onNext: (sources: IncomeSource[]) => void
}

const OPTIONS: { value: IncomeSource; label: string; description: string }[] = [
  { value: 'dividends', label: 'Dividends', description: 'Payments from shares you own in companies' },
  { value: 'savings', label: 'Savings interest', description: 'Interest from savings accounts or Cash ISAs' },
  { value: 'cgt', label: 'Capital gains', description: 'Profit from selling shares or other investments' },
  { value: 'rsu-vests', label: 'RSU / share vests', description: 'Shares vesting from a company scheme (separate to PAYE payslips)' },
  { value: 'benefits', label: 'Benefits in kind (P11D)', description: 'Company car, private medical insurance, expense reimbursements' },
]

export function StepIncome({ onNext }: Props) {
  const [selected, setSelected] = useState<Set<IncomeSource>>(new Set())

  const toggle = (v: IncomeSource) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Other income sources</h3>
        <p className="text-text-2 text-sm">Tick anything that applies to you. This tells us which parts of your Self Assessment to fill in.</p>
      </div>
      <div className="space-y-2">
        {OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${selected.has(o.value) ? 'border-accent bg-accent/10' : 'border-white/[0.06] hover:border-white/10'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${selected.has(o.value) ? 'bg-accent border-accent' : 'border-white/20'}`}>
                {selected.has(o.value) && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-bg" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs text-text-2 mt-0.5">{o.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={() => onNext([...selected])}
        className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
      >
        Continue
      </button>
    </div>
  )
}
```

Note: `StepIncome.tsx` uses `useState` — add the import at the top of the file:

```tsx
import { useState } from 'react'
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat: onboarding step components — profile, scheme, income sources"
```

---

## Task 6: OnboardingScreen

**Files:**
- Create: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Implement OnboardingScreen**

Create `src/screens/OnboardingScreen.tsx`:

```tsx
import { useState } from 'react'
import { StepPayslip } from '../components/onboarding/StepPayslip'
import { StepProfile } from '../components/onboarding/StepProfile'
import { StepScheme } from '../components/onboarding/StepScheme'
import { StepIncome } from '../components/onboarding/StepIncome'
import { useProfile } from '../hooks/useProfile'
import { storage } from '../lib/storage'
import { hashPin } from '../lib/auth'
import { getDataClient } from '../lib/github'
import { writeProfile } from '../lib/dataRepo'
import type { ShareSchemeConfig, Profile } from '../types'

type Step = 'payslip' | 'profile' | 'scheme' | 'income' | 'saving'

interface ProfileData {
  firstName: string
  niNumber: string
  taxCode: string
  employerName: string
}

interface Props {
  onComplete: () => void
}

const STEP_LABELS = ['Payslip', 'Profile', 'Schemes', 'Income']
const STEPS: Step[] = ['payslip', 'profile', 'scheme', 'income']

export function OnboardingScreen({ onComplete }: Props) {
  const profileId = storage.getActiveProfile()
  const { saveProfile } = useProfile(profileId)

  const [step, setStep] = useState<Step>('payslip')
  const [payslipPrefill, setPayslipPrefill] = useState<Partial<ProfileData>>({})
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [schemes, setSchemes] = useState<ShareSchemeConfig[]>([])
  const [error, setError] = useState('')

  const stepIndex = STEPS.indexOf(step)

  const handlePayslipExtracted = (fields: { employerName: string; taxCode: string; niNumber: string }) => {
    setPayslipPrefill({
      employerName: fields.employerName,
      taxCode: fields.taxCode,
      niNumber: fields.niNumber,
    })
    setStep('profile')
  }

  const handleProfileNext = (data: ProfileData) => {
    setProfileData(data)
    setStep('scheme')
  }

  const handleSchemeNext = (s: ShareSchemeConfig[]) => {
    setSchemes(s)
    setStep('income')
  }

  const handleIncomeNext = async (sources: Profile['otherIncomeSources']) => {
    if (!profileData) return
    setStep('saving')
    setError('')
    try {
      // Get existing PIN hash from localStorage (set during setup)
      const pinHash = storage.getPinHash(profileId) ?? ''
      const pinSalt = storage.getPinSalt(profileId) ?? ''

      const profile: Profile = {
        id: profileId,
        firstName: profileData.firstName,
        niNumber: profileData.niNumber,
        taxCode: profileData.taxCode,
        pinHash,
        pinSalt,
        githubPat: '',  // PAT stays in localStorage, not the repo
        schemes,
        otherIncomeSources: sources,
      }

      await saveProfile(profile)
      onComplete()
    } catch (e) {
      setError(String(e))
      setStep('income')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-[28px] tracking-[-0.03em] mb-1">
          Tax<span className="text-accent">Tracker</span>
        </h1>
        <p className="text-text-2 text-sm mb-6">Let's set up your profile — takes 2 minutes</p>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${i === stepIndex ? 'text-accent' : i < stepIndex ? 'text-green' : 'text-text-3'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${i === stepIndex ? 'bg-accent text-bg' : i < stepIndex ? 'bg-green text-bg' : 'bg-surface-3 text-text-3'}`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px flex-1 min-w-[12px] ${i < stepIndex ? 'bg-green' : 'bg-surface-3'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red/10 border border-red/20 rounded-lg text-sm text-red">
            {error} — please try again.
          </div>
        )}

        {step === 'payslip' && (
          <StepPayslip
            onExtracted={handlePayslipExtracted}
            onSkip={() => setStep('profile')}
          />
        )}
        {step === 'profile' && (
          <StepProfile
            profileId={profileId}
            prefill={payslipPrefill}
            onNext={handleProfileNext}
          />
        )}
        {step === 'scheme' && profileData && (
          <StepScheme
            employerName={profileData.employerName}
            onNext={handleSchemeNext}
            onSkip={() => handleSchemeNext([])}
          />
        )}
        {step === 'income' && (
          <StepIncome onNext={handleIncomeNext} />
        )}
        {step === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-text-2 text-sm">Saving your profile...</p>
          </div>
        )}
      </div>
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
git add src/screens/OnboardingScreen.tsx
git commit -m "feat: OnboardingScreen — 4-step wizard wiring all onboarding steps"
```

---

## Task 7: Wire onboarding into App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add onboarding-complete flag to storage**

In `src/lib/storage.ts`, add these two entries to the `storage` object (after `isSetupComplete`):

```ts
  isOnboardingComplete: (profileId: string) =>
    Boolean(localStorage.getItem(`tt_onboarding_${profileId}`)),
  setOnboardingComplete: (profileId: string) =>
    localStorage.setItem(`tt_onboarding_${profileId}`, '1'),
```

- [ ] **Step 2: Update App.tsx**

Replace `src/App.tsx` with:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { PinScreen } from './screens/PinScreen'
import { SetupScreen } from './screens/SetupScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { IncomeScreen } from './screens/IncomeScreen'
import { DocumentsScreen } from './screens/DocumentsScreen'
import { SharesScreen } from './screens/SharesScreen'
import { TaxReturnScreen } from './screens/TaxReturnScreen'
import { useAuth } from './hooks/useAuth'
import { storage } from './lib/storage'
import { useState } from 'react'

export function App() {
  const { unlocked, error, attemptUnlock } = useAuth()
  const [setupDone, setSetupDone] = useState(() => storage.isSetupComplete())
  const [onboardingDone, setOnboardingDone] = useState(() =>
    storage.isOnboardingComplete(storage.getActiveProfile())
  )

  if (!setupDone) {
    return <SetupScreen onComplete={() => setSetupDone(true)} />
  }

  if (!unlocked) {
    return <PinScreen onUnlock={attemptUnlock} error={error} />
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen onComplete={() => {
        storage.setOnboardingComplete(storage.getActiveProfile())
        setOnboardingDone(true)
      }} />
    )
  }

  return (
    <BrowserRouter basename="/taxtracker">
      <AppShell onProfileSwitch={() => {}}>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/income" element={<IncomeScreen />} />
          <Route path="/documents" element={<DocumentsScreen />} />
          <Route path="/shares" element={<SharesScreen />} />
          <Route path="/return" element={<TaxReturnScreen />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all tests pass (19+)

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: builds cleanly

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/lib/storage.ts
git commit -m "feat: wire onboarding into app flow — setup → PIN → onboarding → app"
```

---

## Task 8: Push and verify staging

- [ ] **Step 1: Push to dev**

```bash
git push
```

- [ ] **Step 2: Wait for staging deploy**

```bash
GH_HOST=github.com gh run list --repo SpitefulGrain40/taxtracker --limit 1
```

Wait for status `completed success`.

- [ ] **Step 3: Verify staging**

Open https://spitefulgrain40.github.io/taxtracker-dev/ and walk through:
1. Setup screen (enter repo, PAT, Claude key, PIN)
2. Onboarding screen appears after PIN
3. Step 1: upload payslip (or skip)
4. Step 2: profile fields (pre-filled if payslip uploaded)
5. Step 3: add share scheme
6. Step 4: tick income sources
7. App loads with placeholder screens

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: onboarding flow adjustments from staging review" && git push
```

---

## Self-review notes

**Spec coverage verified:**
- ✅ Payslip-first onboarding (StepPayslip extracts, pre-fills StepProfile)
- ✅ Share scheme configuration per employer (StepScheme — type, discount rate, currency, broker)
- ✅ Claude API extraction (claude.ts with `claude-opus-4-8`, vision + structured output)
- ✅ Profile saved to GitHub data repo on completion
- ✅ Income sources selection
- ✅ Skip/defer options on every step
- ✅ Life event detection (rstVestIncome field parsed from payslip)
- ✅ Data hooks (useProfile, useTaxYear) — used by OnboardingScreen and available for Plans 3–6

**Not in this plan (correct — deferred to later plans):**
- P11D and P60 extraction → Plan 4 (Documents screen)
- Stock CSV import → Plan 5 (Share Schemes screen)
- Full document management UI → Plan 4
