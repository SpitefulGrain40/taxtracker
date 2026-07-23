# Plan 9: Account area, More drawer & in-app feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the user a place to see and correct their own data — a **More drawer** as the 5th nav destination and an **Account screen** for editing profile, base salary, saved payslip figures, future income events and share schemes — plus an in-app **Submit feedback** button that writes to the private data repo.

**Architecture:** Nav restructures so Tax Return leaves the bottom bar and becomes the top entry of a new `MoreDrawer` slide-over; `AppShell` owns the drawer's open state. A new `/account` route hosts `AccountScreen`, composed of four independent, separately-testable section components that each save through the existing GitHub-backed hooks. Feedback appends a `FeedbackEntry` to `feedback.json` in the private data repo via the existing `GitHubDataClient` — no new token scope, no backend.

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Tailwind v4, Lucide React, React Router v6, Vitest + React Testing Library. Reuses `src/lib/dataRepo.ts`, `src/lib/github.ts`, `src/hooks/useProfile.ts`, `src/hooks/useTaxYear.ts`, `src/hooks/useFutureEvents.ts`, `src/components/ui/*`.

## Global Constraints

- **Shared clone.** Another session may have uncommitted work in this tree. Commit with **explicit file paths** (`git add path/to/file`) — **never** `git add -A` or `git add .` or `git commit -am`.
- Work on branch `dev`. Never commit to `main`.
- No emojis in the UI — Lucide React icons only, 2px stroke.
- Design tokens live in `src/index.css @theme`. No inline hex.
- **Plain English first** — every layman-facing tax term needs a `JargonTip`.
- Secrets (PAT, Claude key) stay in `localStorage` only — never written to the data repo, never rendered.
- No backend. Data goes through `GitHubDataClient`.
- Run `npm run test` (currently **134 passing**) and `npm run build` before every commit.
- Never fabricate figures. Empty/unknown data renders an explicit empty state.

---

## File structure

```
src/
├── types/index.ts                                MODIFY — FeedbackEntry
├── lib/
│   ├── dataRepo.ts                                MODIFY — feedbackPath/readFeedback/appendFeedback
│   └── dataRepo.test.ts                           MODIFY — tests for the above
├── components/
│   ├── layout/
│   │   ├── MoreDrawer.tsx                          NEW — slide-over menu
│   │   ├── MoreDrawer.test.tsx                     NEW
│   │   ├── AppShell.tsx                            MODIFY — owns drawer state, renders MoreDrawer
│   │   ├── MobileNav.tsx                           MODIFY — Return tab -> More (button)
│   │   └── DesktopNav.tsx                          MODIFY — Tax Return item -> More (button)
│   └── account/
│       ├── ProfileSection.tsx                      NEW — name/NI/tax code/base salary
│       ├── PayslipSection.tsx                      NEW — correct saved payslip figures
│       ├── FutureEventsSection.tsx                 NEW — bonus / pay-rise / RSU vest editor
│       ├── SchemesSection.tsx                      NEW — share scheme config editor
│       └── FeedbackForm.tsx                        NEW — feedback form (rendered in drawer)
├── screens/
│   └── AccountScreen.tsx                           NEW — composes the four sections
├── AppRouter.tsx                                   MODIFY — /account route, threads onLock
└── App.tsx                                         MODIFY — passes lock() into AppRouter
```

---

## Task 1: Feedback data layer

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/dataRepo.ts`
- Test: `src/lib/dataRepo.test.ts`

**Interfaces:**
- Produces: `FeedbackEntry`; `feedbackPath()`, `readFeedback(client)`, `appendFeedback(client, entry)`.

**Note on a spec deviation:** the design spec listed `appVersion` on `FeedbackEntry`. `package.json` is still `0.0.0` and is never bumped, so an `appVersion` field would record false precision. Use **`appEnv`** instead, populated from `import.meta.env.MODE` — it actually distinguishes staging from production feedback.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/dataRepo.test.ts` (the file already imports `describe/it/expect/vi/beforeEach` from vitest):

```ts
import { feedbackPath, readFeedback, appendFeedback } from './dataRepo'
import type { FeedbackEntry } from '../types'

const fbClient = { readFile: vi.fn(), writeFile: vi.fn() }

const entry: FeedbackEntry = {
  id: 'f1', text: 'The projected figure is confusing', screen: '/',
  profileId: 'mike', appEnv: 'production', createdAt: '2026-07-23T10:00:00.000Z',
}

describe('feedback data repo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('feedbackPath is a shared repo-root file', () => {
    expect(feedbackPath()).toBe('feedback.json')
  })

  it('readFeedback reads the feedback file', async () => {
    fbClient.readFile.mockResolvedValue({ data: [entry], sha: 'x' })
    const result = await readFeedback(fbClient as never)
    expect(fbClient.readFile).toHaveBeenCalledWith('feedback.json')
    expect(result?.data).toEqual([entry])
  })

  it('appendFeedback appends to existing entries and passes the sha', async () => {
    fbClient.readFile.mockResolvedValue({ data: [entry], sha: 'sha1' })
    fbClient.writeFile.mockResolvedValue(undefined)
    const second: FeedbackEntry = { ...entry, id: 'f2', text: 'second' }
    await appendFeedback(fbClient as never, second)
    expect(fbClient.writeFile).toHaveBeenCalledWith('feedback.json', [entry, second], 'sha1')
  })

  it('appendFeedback creates the file when none exists', async () => {
    fbClient.readFile.mockResolvedValue(null)
    fbClient.writeFile.mockResolvedValue(undefined)
    await appendFeedback(fbClient as never, entry)
    expect(fbClient.writeFile).toHaveBeenCalledWith('feedback.json', [entry], undefined)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dataRepo.test.ts`
Expected: FAIL — `feedbackPath` / `readFeedback` / `appendFeedback` are not exported.

- [ ] **Step 3: Add the type** — in `src/types/index.ts`, after the `FutureIncomeEvent` block:

```ts
// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface FeedbackEntry {
  id: string
  text: string
  screen: string          // route the user was on when they submitted
  profileId: ProfileId
  appEnv: string          // import.meta.env.MODE — distinguishes staging vs production
  createdAt: string       // ISO
}
```

- [ ] **Step 4: Add the data-repo helpers** — extend the type import in `src/lib/dataRepo.ts` with `FeedbackEntry`, then append:

```ts
// ─── Feedback (shared across profiles) ────────────────────────────────────────

export const feedbackPath = () => 'feedback.json'

export async function readFeedback(client: GitHubDataClient) {
  return client.readFile<FeedbackEntry[]>(feedbackPath())
}

export async function appendFeedback(client: GitHubDataClient, entry: FeedbackEntry) {
  const existing = await readFeedback(client)
  const next = [...(existing?.data ?? []), entry]
  return client.writeFile(feedbackPath(), next, existing?.sha)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/dataRepo.test.ts`
Expected: PASS.

- [ ] **Step 6: Full suite + build, then commit**

Run: `npm run test` (expect 134 + 4 = 138) and `npm run build` (clean).

```bash
git add src/types/index.ts src/lib/dataRepo.ts src/lib/dataRepo.test.ts
git commit -m "feat: feedback entry type + data-repo append helpers (#4)"
```

---

## Task 2: `MoreDrawer` component

**Files:**
- Create: `src/components/layout/MoreDrawer.tsx`
- Test: `src/components/layout/MoreDrawer.test.tsx`

**Interfaces:**
- Produces: `MoreDrawer` with props
  `{ open: boolean; onClose: () => void; onNavigate: (to: string) => void; onSubmitFeedback: () => void; onSwitchProfile: () => void; onLock: () => void; profileName: string }`.

Presentational only — it renders entries and calls back. Order per the design: **Tax Return, Account & profile, Price settings, Submit feedback, Switch profile, Lock.** Tax Return → `/return`, Account & profile → `/account`, Price settings → `/shares` (price settings live on the Shares screen; deep-link rather than duplicating them).

- [ ] **Step 1: Write the failing test** — `src/components/layout/MoreDrawer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MoreDrawer } from './MoreDrawer'

const props = {
  open: true, onClose: () => {}, onNavigate: vi.fn(), onSubmitFeedback: vi.fn(),
  onSwitchProfile: vi.fn(), onLock: vi.fn(), profileName: 'Mike',
}

describe('MoreDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MoreDrawer {...props} open={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists Tax Return first, then account and actions', () => {
    render(<MoreDrawer {...props} />)
    expect(screen.getByRole('button', { name: /tax return/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /account & profile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /price settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lock/i })).toBeInTheDocument()
  })

  it('navigates to the account route', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /account & profile/i }).click()
    expect(props.onNavigate).toHaveBeenCalledWith('/account')
  })

  it('navigates to the tax return route', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /tax return/i }).click()
    expect(props.onNavigate).toHaveBeenCalledWith('/return')
  })

  it('triggers lock', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /lock/i }).click()
    expect(props.onLock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/MoreDrawer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component** — `src/components/layout/MoreDrawer.tsx`:

```tsx
import { ClipboardCheck, UserCog, LineChart, MessageSquare, Users, Lock, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (to: string) => void
  onSubmitFeedback: () => void
  onSwitchProfile: () => void
  onLock: () => void
  profileName: string
}

export function MoreDrawer({ open, onClose, onNavigate, onSubmitFeedback, onSwitchProfile, onLock, profileName }: Props) {
  if (!open) return null

  const items = [
    { label: 'Tax Return', icon: ClipboardCheck, onClick: () => onNavigate('/return') },
    { label: 'Account & profile', icon: UserCog, onClick: () => onNavigate('/account') },
    { label: 'Price settings', icon: LineChart, onClick: () => onNavigate('/shares') },
    { label: 'Submit feedback', icon: MessageSquare, onClick: onSubmitFeedback },
    { label: `Switch profile (${profileName})`, icon: Users, onClick: onSwitchProfile },
    { label: 'Lock', icon: Lock, onClick: onLock },
  ]

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-surface border-l border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06]">
          <span className="font-serif text-base">More</span>
          <button onClick={onClose} aria-label="Close" className="text-text-2 hover:text-text-1 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-2">
          {items.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-text-1 hover:bg-surface-3 transition-colors text-left"
            >
              <Icon size={16} className="text-text-2 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/MoreDrawer.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MoreDrawer.tsx src/components/layout/MoreDrawer.test.tsx
git commit -m "feat: MoreDrawer slide-over menu (#3)"
```

---

## Task 3: Nav restructure, drawer wiring, `/account` route

**Files:**
- Modify: `src/components/layout/MobileNav.tsx`
- Modify: `src/components/layout/DesktopNav.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/AppRouter.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `MoreDrawer` (Task 2).
- Produces: `AppShell` prop `onLock: () => void`; `AppRouter` prop `onLock: () => void`; `MobileNav`/`DesktopNav` prop `onMoreClick: () => void`; route `/account`.

Requirements:
1. **MobileNav:** keep exactly 5 bottom items. Replace the `/return` tab with a **More** entry (`MoreHorizontal` from lucide) that is a `<button>` calling `onMoreClick` — not a `NavLink`. Keep the existing grid/active styling for the four `NavLink`s; the More button uses the inactive style.
2. **DesktopNav:** replace the `Tax Return` nav item with the same **More** button (`onMoreClick`), styled like the other items but as a `<button>`.
3. **AppShell:** owns `const [moreOpen, setMoreOpen] = useState(false)`; passes `onMoreClick={() => setMoreOpen(true)}` to both navs; renders `<MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} ... />`. Use `useNavigate()` for `onNavigate` (close the drawer after navigating). `onSwitchProfile`: call the existing `onProfileSwitch` prop. `onLock`: call a new `onLock` prop. Feedback wiring is Task 8 — for now pass a no-op `onSubmitFeedback={() => {}}` and leave a `// wired in Task 8` comment.
4. **AppRouter:** add `<Route path="/account" element={<AccountScreen />} />`. `AccountScreen` does not exist until Task 4 — so in THIS task create a minimal placeholder `src/screens/AccountScreen.tsx` exporting a component that renders a heading "Account" only; Task 4 fills it in.
5. **App.tsx:** `useAuth()` already returns `lock`; pass it down: `<AppRouter onLock={lock} />`.

- [ ] **Step 1: Make the changes** across the five files per the requirements above, plus the placeholder `AccountScreen`.

- [ ] **Step 2: Verify build + tests**

Run: `npm run build` (clean — catches prop-type mismatches) and `npm run test` (expect 138 + 5 from Task 2 = 143; existing tests must not break).

- [ ] **Step 3: Commit (explicit paths only)**

```bash
git add src/components/layout/MobileNav.tsx src/components/layout/DesktopNav.tsx src/components/layout/AppShell.tsx src/AppRouter.tsx src/App.tsx src/screens/AccountScreen.tsx
git commit -m "feat: More drawer nav restructure, /account route, lock wiring (#3)"
```

---

## Task 4: Account screen — profile & base salary

**Files:**
- Create: `src/components/account/ProfileSection.tsx`
- Modify: `src/screens/AccountScreen.tsx` (replace the Task 3 placeholder)

**Interfaces:**
- Consumes: `useProfile` (`{ profile, loading, error, saveProfile }`), types `Profile`.
- Produces: `ProfileSection` with props `{ profile: Profile; onSave: (p: Profile) => Promise<void> }`.

Requirements:
- `AccountScreen` reads `storage.getActiveProfile()` and `useProfile(profileId)`. While `loading`, render a loading line. If there is no profile yet, render an explicit empty state ("No profile saved yet — finish onboarding first."), never blank.
- `ProfileSection` renders editable fields: **First name**, **NI number** (`font-mono`), **Tax code** (`font-mono`), **Annual base salary** (`font-mono`, numeric — strip non-numeric input as `StepSalary` does). Local state seeded from the `profile` prop.
- A **Save** button calls `onSave` with the updated `Profile` (spread the original so unrelated fields such as `pinHash`, `pinSalt`, `schemes`, `otherIncomeSources` are preserved). Show saving/saved/error state. Disable Save while saving.
- Base salary: empty input → `baseAnnualSalary` omitted from the object (not `0`), matching Plan 7's `buildOnboardingData` behaviour. Add a short note that it feeds the year-end projection.
- `NI number` and `Tax code` need `JargonTip`s (tax code especially — explain K-codes briefly).
- **Never render the GitHub PAT or Claude key.**

- [ ] **Step 1: Write the section + screen** per the requirements.
- [ ] **Step 2: Verify** — `npm run build` and `npm run test` (all pass).
- [ ] **Step 3: Commit**

```bash
git add src/components/account/ProfileSection.tsx src/screens/AccountScreen.tsx
git commit -m "feat: Account screen — edit profile and base salary (#3)"
```

---

## Task 5: Account screen — correct saved payslip figures

**Files:**
- Create: `src/components/account/PayslipSection.tsx`
- Modify: `src/screens/AccountScreen.tsx`

**Interfaces:**
- Consumes: `useTaxYear` (`{ taxYear, loading, saveTaxYear }`), types `TaxYear`, `Payslip`.
- Produces: `PayslipSection` with props `{ taxYear: TaxYear; onSave: (ty: TaxYear) => Promise<void> }`.

This is the "correct anything that isn't quite right" requirement — a wrong AI extraction must be fixable here.

Requirements:
- Operate on the **latest** payslip (highest `taxPeriod`) across `taxYear.employment[].payslips[]`. If there are none, render an explicit empty state pointing at Documents — do not render an editor over fabricated zeros.
- Editable numeric fields (all `font-mono`): `ytdGross`, `ytdTaxPaid`, `ytdEmployeeNI`, `basicSalary`, `taxPaid`, `employeeNI`, plus `taxCode` (text) and `taxPeriod` (1–12).
- Save must update the payslip **immutably** — rebuild `employment` / `payslips` arrays rather than mutating (a prior bug in this codebase, see commit d753f28). Preserve every field not shown in the editor (`rawExtracted`, `salarySacrifice`, `otherPayments`, `esppContribution`, `employerMatch`, `id`, `date`, `employerName`, `niNumber`).
- Show a short note that these figures drive the Dashboard, Income and the year-end projection.
- `JargonTip` for "year to date".

- [ ] **Step 1: Write the section**, wire into `AccountScreen`.
- [ ] **Step 2: Verify** — `npm run build`, `npm run test`.
- [ ] **Step 3: Commit**

```bash
git add src/components/account/PayslipSection.tsx src/screens/AccountScreen.tsx
git commit -m "feat: Account screen — correct saved payslip figures (#3)"
```

---

## Task 6: Account screen — future income events editor

**Files:**
- Create: `src/components/account/FutureEventsSection.tsx`
- Modify: `src/screens/AccountScreen.tsx`

**Interfaces:**
- Consumes: `useFutureEvents` (`{ events, loading, saveEvents }`), types `FutureIncomeEvent`, `FutureIncomeEventType`.
- Produces: `FutureEventsSection` with props `{ events: FutureIncomeEvent[]; taxYearKey: TaxYearKey; onSave: (e: FutureIncomeEvent[]) => Promise<void> }`.

This is where the user adds the bonus the Plan 8 projection consumes.

Requirements:
- List existing events (label, type, amount, effective date) with a **Remove** control each.
- An **Add** form: type (`bonus` | `pay-rise` | `rsu-vest` — a select), label, amount (numeric, `font-mono`), effective date (`<input type="date">`). New entries get `id: crypto.randomUUID()`, `taxYear: taxYearKey`, `subjectToNI: true`.
- Plain-English helper text per type — importantly, for **pay-rise** the `amount` is the **new annual salary**, not the increase (this is how `projection.ts` interprets it). Say so in the UI or the projection will be wrong.
- Save calls `onSave` with the full updated array. Show saving/error state.
- Empty state when there are no events: explain that adding an expected bonus lets the app warn about a year-end shortfall.

- [ ] **Step 1: Write the section**, wire into `AccountScreen`.
- [ ] **Step 2: Verify** — `npm run build`, `npm run test`.
- [ ] **Step 3: Commit**

```bash
git add src/components/account/FutureEventsSection.tsx src/screens/AccountScreen.tsx
git commit -m "feat: Account screen — future income events editor (#3)"
```

---

## Task 7: Account screen — share scheme editor

**Files:**
- Create: `src/components/account/SchemesSection.tsx`
- Modify: `src/screens/AccountScreen.tsx`

**Interfaces:**
- Consumes: `useProfile` (`saveProfile`), types `Profile`, `ShareSchemeConfig`, `SchemeType`.
- Produces: `SchemesSection` with props `{ profile: Profile; onSave: (p: Profile) => Promise<void> }`.

**Principle: never hardcode anyone's scheme.** Schemes are user-configured data so either user can reshape them when they change jobs. This also lays the groundwork for issue #5 (Gemma's discounted ESPP).

Requirements:
- List `profile.schemes` with add / edit / remove.
- Editable per scheme: `employerName`, `schemeType` (select over the real union: `espp-match`, `espp-discounted`, `rsu`, `csop`, `emi`, `saye`), `discountRate` (shown as a **percentage** in the UI, stored as a fraction — e.g. 15 in the box → `0.15` stored), `currency` (e.g. `EUR`, `USD`), `exchange`, `broker`, `active`.
- `discountRate` input is only shown when `schemeType === 'espp-discounted'`.
- New schemes get `id: crypto.randomUUID()`.
- Save spreads the existing profile (`{ ...profile, schemes }`) so unrelated fields survive.
- `JargonTip` for "ESPP" and "RSU".

- [ ] **Step 1: Write the section**, wire into `AccountScreen`.
- [ ] **Step 2: Verify** — `npm run build`, `npm run test`.
- [ ] **Step 3: Commit**

```bash
git add src/components/account/SchemesSection.tsx src/screens/AccountScreen.tsx
git commit -m "feat: Account screen — editable share scheme config (#3)"
```

---

## Task 8: Feedback form wired into the drawer

**Files:**
- Create: `src/components/account/FeedbackForm.tsx`
- Modify: `src/components/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `appendFeedback` (Task 1), `getDataClient`, `storage`, `useLocation` (for the captured route).
- Produces: `FeedbackForm` with props `{ open: boolean; onClose: () => void; screen: string }`.

Requirements:
- Opened from the drawer's **Submit feedback** entry (replace the Task 3 no-op).
- A textarea plus Send / Cancel. On send, build a `FeedbackEntry`:
  `{ id: crypto.randomUUID(), text, screen, profileId: storage.getActiveProfile(), appEnv: import.meta.env.MODE, createdAt: new Date().toISOString() }`
  and call `appendFeedback(getDataClient(pat, repo), entry)` using the PAT from `storage.getGithubPat()` and repo from `localStorage.getItem('tt_data_repo')` — the same pattern the hooks use.
- If the PAT/repo are missing, show a plain-English error rather than throwing.
- Show sending / sent confirmation / error states. Disable Send while sending and for empty text.
- Capture the current route via `useLocation().pathname` in `AppShell` and pass as `screen`.

- [ ] **Step 1: Write the form**, wire it into `AppShell`.
- [ ] **Step 2: Verify** — `npm run build`, `npm run test`.
- [ ] **Step 3: Commit**

```bash
git add src/components/account/FeedbackForm.tsx src/components/layout/AppShell.tsx
git commit -m "feat: in-app feedback form writing to the data repo (#4)"
```

---

## Task 9: Deploy to staging + verify

**Files:** none.

- [ ] **Step 1: Confirm clean state and push**

```bash
git status -s
git push origin dev
```

- [ ] **Step 2: Confirm the staging deploy is green**

Run: `gh run watch $(gh run list --branch dev --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`

- [ ] **Step 3: Update the issues**

```bash
gh issue comment 3 --body "Account area + More drawer shipped to dev/staging: Tax Return moved into a More drawer (5th nav slot), new /account screen editing profile, base salary, saved payslip figures, future income events, and share schemes."
gh issue comment 4 --body "In-app feedback shipped to dev/staging: Submit feedback in the More drawer appends to feedback.json in the private data repo, capturing the screen you came from."
```

Leave #3 and #4 open until confirmed on device; close them then.

---

## Self-review notes

- **Spec coverage:** More drawer + nav restructure (Tax Return to drawer top) → Tasks 2/3; Account screen editing profile/base salary → Task 4; correcting payslip figures ("correct anything that isn't quite right") → Task 5; future income events (the bonus the projection consumes) → Task 6; flexible editable scheme config → Task 7; feedback button → Tasks 1/8.
- **Deliberate deviation:** `FeedbackEntry.appVersion` (spec) → `appEnv` from `import.meta.env.MODE`, because `package.json` version is never bumped and would record false precision.
- **Deferred:** issue #8 polish minors, and issue #5 (entering Gemma's actual scheme data) — Task 7 builds the editor that makes #5 pure data entry.
- **Testing note:** Tasks 4–7 are form-heavy integration; they are verified by build + the existing suite. Tasks 1 and 2 carry the new unit tests. If a section grows non-trivial derived logic (e.g. the percentage↔fraction conversion in Task 7), add a focused unit test for that logic.
- **Shared-clone risk:** every commit uses explicit paths; no `git add -A`. A previous session lost work to `git commit -am`.
