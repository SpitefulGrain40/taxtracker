# Plan 7: Editable data foundation + payslip persistence fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make onboarding actually persist the extracted payslip (and optional stated salary/bonus) into the data repo so the Dashboard/Income show real figures instead of zeros, and add a clear empty state when no payslip exists.

**Architecture:** Add a `FutureIncomeEvent` type and data-repo helpers, a pure `buildOnboardingData` assembler that turns onboarding inputs into `{profile, taxYear, futureEvents}` (fully unit-tested — this is the fix's core logic), then wire `OnboardingScreen` to save all three via the existing GitHub-backed hooks. Screens gain a shared empty state.

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`), Tailwind v4, Lucide React, Vitest. Reuses `src/lib/dataRepo.ts`, `src/lib/github.ts`, `src/hooks/useTaxYear.ts`, `src/hooks/useProfile.ts`, `src/lib/taxYears.ts`.

## Global Constraints

- Work on branch `dev`. Never commit to `main`.
- No emojis in the UI — Lucide React icons only.
- Design tokens live in `src/index.css @theme`, not `tailwind.config.ts`.
- Secrets (PAT, Claude key) live in `localStorage` only — never in source, git, or the data repo.
- No backend — static PWA. Data reads/writes go through `GitHubDataClient`.
- Run `npm run test` after any change under `src/lib/` or `src/components/ui/`. All tests must pass before committing (currently 104).
- Never fabricate figures. A missing payslip yields an explicit empty state, not a zero.

---

## File structure

```
src/
├── types/index.ts                          MODIFY — FutureIncomeEvent(+Type), Profile.baseAnnualSalary?
├── lib/
│   ├── dataRepo.ts                          MODIFY — future-events helpers + taxYearWithPayslip()
│   ├── dataRepo.test.ts                     MODIFY — tests for the above
│   ├── onboardingData.ts                    NEW — pure buildOnboardingData() assembler
│   └── onboardingData.test.ts               NEW — unit tests (the fix's core logic)
├── hooks/
│   └── useFutureEvents.ts                    NEW — GitHub-backed future-events hook
├── components/
│   ├── onboarding/StepSalary.tsx             NEW — optional base salary + expected bonus
│   └── ui/FirstPayslipPrompt.tsx             NEW — shared "add your first payslip" empty state
└── screens/
    ├── OnboardingScreen.tsx                  MODIFY — carry full payslip, save taxYear + events + salary
    ├── DashboardScreen.tsx                   MODIFY — empty state when no payslip
    └── IncomeScreen.tsx                      MODIFY — empty state when no payslip
```

---

## Task 1: Future-income types + data-repo helpers

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/dataRepo.ts`
- Test: `src/lib/dataRepo.test.ts`

**Interfaces:**
- Produces: `FutureIncomeEventType`, `FutureIncomeEvent`, `Profile.baseAnnualSalary?`; `futureEventsPath()`, `readFutureEvents()`, `writeFutureEvents()`, `emptyFutureEvents()`, `taxYearWithPayslip(key, payslip)`.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/dataRepo.test.ts`:

```ts
import {
  futureEventsPath, readFutureEvents, writeFutureEvents, emptyFutureEvents, taxYearWithPayslip,
} from './dataRepo'
import type { Payslip } from '../types'

const fePathClient = { readFile: vi.fn(), writeFile: vi.fn() }

describe('future events data repo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('futureEventsPath returns correct path', () => {
    expect(futureEventsPath('mike')).toBe('data/mike/future-events.json')
  })

  it('emptyFutureEvents returns an empty array', () => {
    expect(emptyFutureEvents()).toEqual([])
  })

  it('readFutureEvents reads the future-events file', async () => {
    fePathClient.readFile.mockResolvedValue({ data: [], sha: 'x' })
    const result = await readFutureEvents(fePathClient as never, 'mike')
    expect(fePathClient.readFile).toHaveBeenCalledWith('data/mike/future-events.json')
    expect(result?.data).toEqual([])
  })

  it('writeFutureEvents writes the future-events file', async () => {
    fePathClient.writeFile.mockResolvedValue(undefined)
    await writeFutureEvents(fePathClient as never, 'mike', [], 'sha1')
    expect(fePathClient.writeFile).toHaveBeenCalledWith('data/mike/future-events.json', [], 'sha1')
  })
})

describe('taxYearWithPayslip', () => {
  const payslip: Payslip = {
    id: 'p1', taxPeriod: 4, taxYear: '2025-26', date: '2025-07-31',
    basicSalary: 5000, carAllowance: 0, otherPayments: [], taxPaid: 900, employeeNI: 400,
    salarySacrifice: [], esppContribution: 0, employerMatch: 0,
    ytdGross: 20000, ytdTaxPaid: 3600, ytdEmployeeNI: 1600,
    taxCode: '1257L', niNumber: 'AB123456C', employerName: 'SAP UK Ltd', rawExtracted: {},
  }

  it('builds a TaxYear with one employment entry holding the payslip', () => {
    const ty = taxYearWithPayslip('2025-26', payslip)
    expect(ty.key).toBe('2025-26')
    expect(ty.employment).toHaveLength(1)
    expect(ty.employment[0].employerName).toBe('SAP UK Ltd')
    expect(ty.employment[0].payslips).toEqual([payslip])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dataRepo.test.ts`
Expected: FAIL — `futureEventsPath`/`taxYearWithPayslip` are not exported.

- [ ] **Step 3: Add the types** — in `src/types/index.ts`, in the Life events section add:

```ts
export type FutureIncomeEventType = 'bonus' | 'pay-rise' | 'rsu-vest'

export interface FutureIncomeEvent {
  id: string
  type: FutureIncomeEventType
  label: string
  amount: number          // GBP; for 'pay-rise' this is the new ANNUAL salary
  effectiveDate: string   // ISO; must fall within the tax year to affect it
  taxYear: TaxYearKey
  subjectToNI?: boolean    // default true for bonus/pay-rise/rsu-vest
}
```

And in the `Profile` interface add one field:

```ts
  baseAnnualSalary?: number   // GBP; user-stated current annual base salary
```

- [ ] **Step 4: Add the data-repo helpers** — in `src/lib/dataRepo.ts` extend the type import and append a section:

```ts
// (extend the existing import)
import type { Profile, TaxYear, ShareLot, LifeEvent, ProfileId, TaxYearKey, Payslip, FutureIncomeEvent } from '../types'

// ─── Future income events ─────────────────────────────────────────────────────

export const futureEventsPath = (profileId: ProfileId | string) => `data/${profileId}/future-events.json`

export function emptyFutureEvents(): FutureIncomeEvent[] {
  return []
}

export async function readFutureEvents(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<FutureIncomeEvent[]>(futureEventsPath(profileId))
}

export async function writeFutureEvents(client: GitHubDataClient, profileId: ProfileId | string, events: FutureIncomeEvent[], sha?: string) {
  return client.writeFile(futureEventsPath(profileId), events, sha)
}

// ─── Tax year from a single payslip ───────────────────────────────────────────

export function taxYearWithPayslip(key: TaxYearKey, payslip: Payslip): TaxYear {
  const base = emptyTaxYear(key)
  return {
    ...base,
    employment: [{
      id: `emp-${payslip.employerName.toLowerCase().replace(/\s+/g, '-')}`,
      employerName: payslip.employerName,
      payslips: [payslip],
    }],
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/dataRepo.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/dataRepo.ts src/lib/dataRepo.test.ts
git commit -m "feat: future-income types + data-repo helpers + taxYearWithPayslip"
```

---

## Task 2: Pure `buildOnboardingData` assembler

**Files:**
- Create: `src/lib/onboardingData.ts`
- Test: `src/lib/onboardingData.test.ts`

**Interfaces:**
- Consumes: `taxYearWithPayslip`, `emptyTaxYear` (Task 1); types `Payslip`, `Profile`, `ShareSchemeConfig`, `FutureIncomeEvent`, `TaxYearKey`, `ProfileId`.
- Produces: `buildOnboardingData(input: OnboardingInput): OnboardingData`, plus the `OnboardingInput` / `OnboardingData` interfaces.

- [ ] **Step 1: Write the failing test** — `src/lib/onboardingData.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildOnboardingData, type OnboardingInput } from './onboardingData'
import type { Payslip } from '../types'

const payslip: Payslip = {
  id: 'p1', taxPeriod: 4, taxYear: '2025-26', date: '2025-07-31',
  basicSalary: 5000, carAllowance: 0, otherPayments: [], taxPaid: 900, employeeNI: 400,
  salarySacrifice: [], esppContribution: 0, employerMatch: 0,
  ytdGross: 20000, ytdTaxPaid: 3600, ytdEmployeeNI: 1600,
  taxCode: '1257L', niNumber: 'AB123456C', employerName: 'SAP UK Ltd', rawExtracted: {},
}

const base: OnboardingInput = {
  profileId: 'mike', firstName: 'Mike', niNumber: 'AB123456C', taxCode: '1257L',
  pinHash: 'h', pinSalt: 's', schemes: [], otherIncomeSources: [],
  key: '2025-26', payslip: null, baseAnnualSalary: null, bonus: null,
}

describe('buildOnboardingData', () => {
  it('persists the payslip into the tax year when present', () => {
    const { taxYear } = buildOnboardingData({ ...base, payslip })
    expect(taxYear.employment[0].payslips[0].ytdGross).toBe(20000)
  })

  it('produces an empty tax year when the payslip is skipped', () => {
    const { taxYear } = buildOnboardingData(base)
    expect(taxYear.employment).toEqual([])
  })

  it('includes baseAnnualSalary on the profile only when provided', () => {
    expect(buildOnboardingData(base).profile.baseAnnualSalary).toBeUndefined()
    expect(buildOnboardingData({ ...base, baseAnnualSalary: 60000 }).profile.baseAnnualSalary).toBe(60000)
  })

  it('creates a bonus future-event when a bonus is provided', () => {
    const { futureEvents } = buildOnboardingData({ ...base, bonus: { amount: 8000, effectiveDate: '2025-12-31' } })
    expect(futureEvents).toHaveLength(1)
    expect(futureEvents[0]).toMatchObject({ type: 'bonus', amount: 8000, taxYear: '2025-26', subjectToNI: true })
  })

  it('creates no future-events when no bonus is provided', () => {
    expect(buildOnboardingData(base).futureEvents).toEqual([])
  })

  it('always leaves githubPat empty on the saved profile', () => {
    expect(buildOnboardingData(base).profile.githubPat).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/onboardingData.test.ts`
Expected: FAIL — module `./onboardingData` not found.

- [ ] **Step 3: Write the implementation** — `src/lib/onboardingData.ts`:

```ts
import type { Payslip, Profile, ProfileId, TaxYear, TaxYearKey, ShareSchemeConfig, FutureIncomeEvent } from '../types'
import { emptyTaxYear, taxYearWithPayslip } from './dataRepo'

export interface OnboardingInput {
  profileId: ProfileId
  firstName: string
  niNumber: string
  taxCode: string
  pinHash: string
  pinSalt: string
  schemes: ShareSchemeConfig[]
  otherIncomeSources: Profile['otherIncomeSources']
  key: TaxYearKey
  payslip: Payslip | null
  baseAnnualSalary: number | null
  bonus: { amount: number; effectiveDate: string } | null
}

export interface OnboardingData {
  profile: Profile
  taxYear: TaxYear
  futureEvents: FutureIncomeEvent[]
}

export function buildOnboardingData(input: OnboardingInput): OnboardingData {
  const profile: Profile = {
    id: input.profileId,
    firstName: input.firstName,
    niNumber: input.niNumber,
    taxCode: input.taxCode,
    pinHash: input.pinHash,
    pinSalt: input.pinSalt,
    githubPat: '',
    schemes: input.schemes,
    otherIncomeSources: input.otherIncomeSources,
    ...(input.baseAnnualSalary != null ? { baseAnnualSalary: input.baseAnnualSalary } : {}),
  }

  const taxYear = input.payslip
    ? taxYearWithPayslip(input.key, input.payslip)
    : emptyTaxYear(input.key)

  const futureEvents: FutureIncomeEvent[] = input.bonus
    ? [{
        id: `bonus-${input.key}`,
        type: 'bonus',
        label: 'Expected bonus',
        amount: input.bonus.amount,
        effectiveDate: input.bonus.effectiveDate,
        taxYear: input.key,
        subjectToNI: true,
      }]
    : []

  return { profile, taxYear, futureEvents }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/onboardingData.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboardingData.ts src/lib/onboardingData.test.ts
git commit -m "feat: pure buildOnboardingData assembler (profile + taxYear + future events)"
```

---

## Task 3: `useFutureEvents` hook

**Files:**
- Create: `src/hooks/useFutureEvents.ts`

**Interfaces:**
- Consumes: `readFutureEvents`, `writeFutureEvents` (Task 1); `getDataClient`, `storage`.
- Produces: `useFutureEvents(profileId): { events, sha, loading, error, saveEvents, refetch }`.

- [ ] **Step 1: Write the implementation** — mirror `src/hooks/useTaxYear.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { getDataClient } from '../lib/github'
import { readFutureEvents, writeFutureEvents } from '../lib/dataRepo'
import { storage } from '../lib/storage'
import type { FutureIncomeEvent, ProfileId } from '../types'

interface UseFutureEventsResult {
  events: FutureIncomeEvent[]
  sha: string | null
  loading: boolean
  error: string | null
  saveEvents: (events: FutureIncomeEvent[]) => Promise<void>
  refetch: () => void
}

export function useFutureEvents(profileId: ProfileId): UseFutureEventsResult {
  const [events, setEvents] = useState<FutureIncomeEvent[]>([])
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
    readFutureEvents(client, profileId)
      .then(result => { setEvents(result?.data ?? []); setSha(result?.sha ?? null); setError(null) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [profileId, tick])

  const saveEvents = useCallback(async (updated: FutureIncomeEvent[]) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) throw new Error('Not configured')
    const client = getDataClient(pat, repo)
    await writeFutureEvents(client, profileId, updated, sha ?? undefined)
    setEvents(updated)
    setTick(t => t + 1)
  }, [profileId, sha])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { events, sha, loading, error, saveEvents, refetch }
}
```

- [ ] **Step 2: Verify it typechecks/builds**

Run: `npm run build`
Expected: clean build (no TS errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFutureEvents.ts
git commit -m "feat: useFutureEvents GitHub-backed hook"
```

---

## Task 4: `StepSalary` onboarding step (base salary + expected bonus)

**Files:**
- Create: `src/components/onboarding/StepSalary.tsx`

**Interfaces:**
- Produces: `StepSalary` component with props
  `{ onNext: (data: { baseAnnualSalary: number | null; bonus: { amount: number; effectiveDate: string } | null }) => void; onSkip: () => void }`.

- [ ] **Step 1: Write the component** — `src/components/onboarding/StepSalary.tsx`:

```tsx
import { useState } from 'react'
import { getCurrentTaxYear, getTaxYearEndDate } from '../../lib/taxYears'

interface Props {
  onNext: (data: { baseAnnualSalary: number | null; bonus: { amount: number; effectiveDate: string } | null }) => void
  onSkip: () => void
}

export function StepSalary({ onNext, onSkip }: Props) {
  const [salary, setSalary] = useState('')
  const [bonus, setBonus] = useState('')

  const submit = () => {
    const baseAnnualSalary = salary ? Number(salary) : null
    const bonusAmount = bonus ? Number(bonus) : null
    const effectiveDate = getTaxYearEndDate(getCurrentTaxYear()).toISOString().slice(0, 10)
    onNext({
      baseAnnualSalary: baseAnnualSalary && !Number.isNaN(baseAnnualSalary) ? baseAnnualSalary : null,
      bonus: bonusAmount && !Number.isNaN(bonusAmount) ? { amount: bonusAmount, effectiveDate } : null,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Salary &amp; expected bonus</h3>
        <p className="text-text-2 text-sm">Optional, but it makes your year-end projection far more accurate. Leave blank to estimate from your payslip.</p>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Annual base salary</label>
        <input inputMode="numeric" className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
          value={salary} onChange={e => setSalary(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="60000" />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Expected bonus this tax year</label>
        <input inputMode="numeric" className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
          value={bonus} onChange={e => setBonus(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="8000" />
      </div>
      <button onClick={submit} className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity">Continue</button>
      <button onClick={onSkip} className="w-full text-text-2 text-sm py-2 hover:text-text-1 transition-colors">Skip — I'll add this later</button>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/StepSalary.tsx
git commit -m "feat: StepSalary onboarding step — optional base salary + expected bonus"
```

---

## Task 5: Wire `OnboardingScreen` to persist everything

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

**Interfaces:**
- Consumes: `buildOnboardingData` (Task 2), `useFutureEvents` (Task 3), `StepSalary` (Task 4), `useTaxYear`, `useProfile`, `getCurrentTaxYear`, `getTaxPeriod`.

- [ ] **Step 1: Rework the screen** — replace `src/screens/OnboardingScreen.tsx` with:

```tsx
import { useState } from 'react'
import { StepPayslip } from '../components/onboarding/StepPayslip'
import { StepProfile } from '../components/onboarding/StepProfile'
import { StepScheme } from '../components/onboarding/StepScheme'
import { StepSalary } from '../components/onboarding/StepSalary'
import { StepIncome } from '../components/onboarding/StepIncome'
import { useProfile } from '../hooks/useProfile'
import { useTaxYear } from '../hooks/useTaxYear'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { storage } from '../lib/storage'
import { getCurrentTaxYear, getTaxPeriod } from '../lib/taxYears'
import { buildOnboardingData } from '../lib/onboardingData'
import type { ShareSchemeConfig, Profile, Payslip } from '../types'

type Step = 'payslip' | 'profile' | 'scheme' | 'salary' | 'income' | 'saving'

interface ProfileData { firstName: string; niNumber: string; taxCode: string; employerName: string }
type ExtractedPayslip = Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> & { rawExtracted: Record<string, string> }

interface Props { onComplete: () => void }

const STEP_LABELS = ['Payslip', 'Profile', 'Schemes', 'Salary', 'Income']
const STEPS: Step[] = ['payslip', 'profile', 'scheme', 'salary', 'income']

export function OnboardingScreen({ onComplete }: Props) {
  const profileId = storage.getActiveProfile()
  const { saveProfile } = useProfile(profileId)
  const { saveTaxYear } = useTaxYear(profileId)
  const { saveEvents } = useFutureEvents(profileId)

  const [step, setStep] = useState<Step>('payslip')
  const [payslip, setPayslip] = useState<ExtractedPayslip | null>(null)
  const [payslipPrefill, setPayslipPrefill] = useState<Partial<ProfileData>>({})
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [schemes, setSchemes] = useState<ShareSchemeConfig[]>([])
  const [salary, setSalary] = useState<{ baseAnnualSalary: number | null; bonus: { amount: number; effectiveDate: string } | null }>({ baseAnnualSalary: null, bonus: null })
  const [error, setError] = useState('')

  const stepIndex = STEPS.indexOf(step)

  const handlePayslipExtracted = (fields: ExtractedPayslip) => {
    setPayslip(fields)
    setPayslipPrefill({ employerName: fields.employerName, taxCode: fields.taxCode, niNumber: fields.niNumber })
    setStep('profile')
  }

  const handleProfileNext = (data: ProfileData) => { setProfileData(data); setStep('scheme') }
  const handleSchemeNext = (s: ShareSchemeConfig[]) => { setSchemes(s); setStep('salary') }
  const handleSalaryNext = (data: typeof salary) => { setSalary(data); setStep('income') }

  const handleIncomeNext = async (sources: Profile['otherIncomeSources']) => {
    if (!profileData) return
    setStep('saving')
    setError('')
    try {
      const key = getCurrentTaxYear()
      const fullPayslip: Payslip | null = payslip
        ? { ...payslip, id: `payslip-${key}-${Date.now()}`, taxPeriod: getTaxPeriod(new Date()), taxYear: key }
        : null

      const { profile, taxYear, futureEvents } = buildOnboardingData({
        profileId,
        firstName: profileData.firstName,
        niNumber: profileData.niNumber,
        taxCode: profileData.taxCode,
        pinHash: storage.getPinHash(profileId) ?? '',
        pinSalt: storage.getPinSalt(profileId) ?? '',
        schemes,
        otherIncomeSources: sources,
        key,
        payslip: fullPayslip,
        baseAnnualSalary: salary.baseAnnualSalary,
        bonus: salary.bonus,
      })

      await saveProfile(profile)
      await saveTaxYear(taxYear)
      if (futureEvents.length) await saveEvents(futureEvents)
      onComplete()
    } catch (e) {
      setError(String(e))
      setStep('income')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-[28px] tracking-[-0.03em] mb-1">Tax<span className="text-accent">Tracker</span></h1>
        <p className="text-text-2 text-sm mb-6">Let's set up your profile — takes 2 minutes</p>

        <div className="flex items-center gap-1.5 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5 flex-1">
              <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${i === stepIndex ? 'text-accent' : i < stepIndex ? 'text-green' : 'text-text-3'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${i === stepIndex ? 'bg-accent text-bg' : i < stepIndex ? 'bg-green text-bg' : 'bg-surface-3 text-text-3'}`}>
                  {i < stepIndex ? <span aria-hidden>&#10003;</span> : i + 1}
                </div>
                <span className="hidden sm:inline whitespace-nowrap">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (<div className={`h-px flex-1 min-w-[8px] ${i < stepIndex ? 'bg-green' : 'bg-surface-3'}`} />)}
            </div>
          ))}
        </div>

        {error && (<div className="mb-4 p-3 bg-red/10 border border-red/20 rounded-lg text-sm text-red">{error} — please try again.</div>)}

        {step === 'payslip' && <StepPayslip onExtracted={handlePayslipExtracted} onSkip={() => setStep('profile')} />}
        {step === 'profile' && <StepProfile profileId={profileId} prefill={payslipPrefill} onNext={handleProfileNext} />}
        {step === 'scheme' && profileData && <StepScheme employerName={profileData.employerName} onNext={handleSchemeNext} onSkip={() => handleSchemeNext([])} />}
        {step === 'salary' && <StepSalary onNext={handleSalaryNext} onSkip={() => handleSalaryNext({ baseAnnualSalary: null, bonus: null })} />}
        {step === 'income' && <StepIncome onNext={handleIncomeNext} />}
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

Note: the existing `StepPayslip` already passes the full extracted payslip to `onExtracted` (typed `ExtractedFields`); this screen now keeps it. The `&#10003;` replaces the previous literal check glyph — no emoji.

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: clean build (no unused vars, no type errors).

- [ ] **Step 3: Run the full suite**

Run: `npm run test`
Expected: all tests pass (104 + the new ones from Tasks 1–2).

- [ ] **Step 4: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "fix: onboarding persists payslip into TaxYear + saves base salary and bonus (#1)"
```

---

## Task 6: Shared empty state + wire into Dashboard and Income

**Files:**
- Create: `src/components/ui/FirstPayslipPrompt.tsx`
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/screens/IncomeScreen.tsx`
- Test: `src/screens/DashboardScreen.test.tsx`

**Interfaces:**
- Produces: `FirstPayslipPrompt` component (no props); a `hasAnyPayslip(taxYear)` guard used by both screens.

- [ ] **Step 1: Write the failing test** — `src/screens/DashboardScreen.test.tsx`. Mock the data hooks so the screen receives a **non-null empty tax year** (the real "skipped payslip" state — without a PAT `useTaxYear` leaves `taxYear` null and the screen just shows "Loading"). The mock factories inline their return value to avoid `vi.mock` hoisting issues:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../hooks/useTaxYear', () => ({
  useTaxYear: () => ({
    taxYear: { key: '2025-26', startDate: '2025-04-06', endDate: '2026-04-05', employment: [], dividends: [], savingsInterest: [], benefitsInKind: [] },
    loading: false, sha: null, error: null, saveTaxYear: () => {}, refetch: () => {},
  }),
}))
vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({ profile: null, loading: false, sha: null, error: null, saveProfile: () => {}, refetch: () => {} }),
}))

import { DashboardScreen } from './DashboardScreen'

// A configured user who skipped the payslip has an empty (but non-null) tax year.
// The Dashboard must show the "add your first payslip" prompt, not zeroed stats.
describe('DashboardScreen empty state', () => {
  it('prompts for a first payslip when the tax year has no payslips', () => {
    render(<MemoryRouter><DashboardScreen /></MemoryRouter>)
    expect(screen.getByText(/add your first payslip/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/DashboardScreen.test.tsx`
Expected: FAIL — text not found (screen currently renders zeroed stat cards from the empty tax year).

- [ ] **Step 3: Create the shared prompt** — `src/components/ui/FirstPayslipPrompt.tsx`:

```tsx
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

export function FirstPayslipPrompt() {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-4">
      <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center">
        <FileText size={22} className="text-accent" />
      </div>
      <div>
        <h2 className="font-serif text-xl mb-1">Add your first payslip</h2>
        <p className="text-text-2 text-sm max-w-xs">Upload a payslip and we'll read your figures automatically. Until then there's nothing to show — no guessed numbers.</p>
      </div>
      <Link to="/documents" className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity">Upload a payslip</Link>
    </div>
  )
}
```

- [ ] **Step 4: Add the guard and use it in `DashboardScreen`** — in `src/screens/DashboardScreen.tsx`, add the import and an early return right after the existing `if (loading || !taxYear)` block:

```tsx
import { FirstPayslipPrompt } from '../components/ui/FirstPayslipPrompt'
// ...
  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your tax position…</div>
  }

  const hasAnyPayslip = taxYear.employment.some(e => e.payslips.length > 0)
  if (!hasAnyPayslip) return <FirstPayslipPrompt />
```

- [ ] **Step 5: Use it in `IncomeScreen`** — in `src/screens/IncomeScreen.tsx`, add the same import and, right after its `if (loading || !taxYear)` block:

```tsx
import { FirstPayslipPrompt } from '../components/ui/FirstPayslipPrompt'
// ...
  const hasAnyPayslip = taxYear.employment.some(e => e.payslips.length > 0)
  if (!hasAnyPayslip) return <FirstPayslipPrompt />
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/screens/DashboardScreen.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full suite + build**

Run: `npm run test && npm run build`
Expected: all tests pass, clean build.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/FirstPayslipPrompt.tsx src/screens/DashboardScreen.tsx src/screens/IncomeScreen.tsx src/screens/DashboardScreen.test.tsx
git commit -m "feat: 'add your first payslip' empty state on Dashboard and Income (#1)"
```

---

## Task 7: Verify on staging

**Files:** none (deploy + manual verification).

- [ ] **Step 1: Push and deploy**

```bash
git push origin dev
```

- [ ] **Step 2: Confirm the staging deploy succeeds**

Run: `gh run watch $(gh run list --branch dev --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`
Expected: green.

- [ ] **Step 3: Update the issue**

```bash
gh issue comment 1 --body "Payslip persistence fixed on dev/staging: onboarding now saves the payslip into the TaxYear, plus optional base salary + expected bonus; empty state added when no payslip. Ready for phone re-test."
```

Leave issue #1 **open** until the user confirms real figures show on their phone; close it then with the verifying commit.

---

## Self-review notes

- **Spec coverage:** Feature 1 (payslip persistence + skip empty state) → Tasks 2/5/6; onboarding salary/bonus capture → Tasks 4/5; data-model additions (`FutureIncomeEvent`, `Profile.baseAnnualSalary`) → Task 1. `FeedbackEntry` and `feedback.json` are intentionally deferred to Plan 9 (feedback feature). Projection consumption of `baseAnnualSalary`/events is Plan 8.
- **Type consistency:** `taxYearWithPayslip(key, payslip)`, `buildOnboardingData(input)`, `useFutureEvents().saveEvents`, `hasAnyPayslip` guard used consistently across tasks.
- **No placeholders:** every code step contains full code; the only deferred items are explicitly assigned to Plans 8–9.
```
