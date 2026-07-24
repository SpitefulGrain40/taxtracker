# Plan 11: Share-scheme future-proofing + UI polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close issues #9 and #8. Make the Share Schemes screen drive live pricing from the **user-editable scheme config** (per-scheme ticker + currency) instead of hardcoded SAP defaults (#9), and clear the accumulated presentation/UX/test polish from the Plan 8/9 reviews (#8).

**Architecture:** Additive and low-risk. A new optional `ticker` on `ShareSchemeConfig`, edited in the existing scheme editor; the Shares screen selects the scheme to price from config rather than SAP constants. The polish items are localized edits to existing components plus a small data-hook robustness change (save returns the new sha, removing a stale-sha refetch window).

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Tailwind v4, Lucide, Vitest + React Testing Library. Touches `src/types`, `src/lib/github.ts`, `src/lib/dataRepo.ts`, the data hooks, `src/screens/SharesScreen.tsx`, `src/components/account/*`, `src/components/layout/MoreDrawer.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/IncomeScreen.tsx`, `src/lib/projection.ts`.

## Global Constraints

- Work on branch `dev`. Never commit to `main`.
- Commit with **explicit file paths** — never `git add -A` / `git add .` / `git commit -am`.
- **No new hardcoding.** Scheme-specific values (ticker, currency, employer, discount) come from the editable scheme config, never a literal. This is the point of #9.
- No emojis — Lucide icons only. Tailwind design tokens only (no inline hex). Strict TS.
- **Plain English first** — layman-facing tax terms need a `JargonTip`. Estimates must look like estimates (yellow + label).
- Never fabricate figures — reject invalid input; missing data → explicit empty state.
- Run `npm run test` (currently **199**) and `npm run build` before every commit.

---

## Task 1: Per-scheme `ticker` field (#9)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/account/SchemesSection.tsx`

**Interfaces:**
- Produces: `ShareSchemeConfig.ticker?: string`.

Requirements:
- Add `ticker?: string` to `ShareSchemeConfig` (after `exchange`), commented as the market symbol used for live pricing, e.g. `SAP.DE`, `AAPL`.
- In `SchemesSection.tsx`: add a `ticker` field to `SchemeRow`, seed it in `rowFromScheme`/`newRow`, add an editable input in the form (same styling as `exchange`), and include `ticker: row.ticker.trim()` in the built `ShareSchemeConfig` on save (omit the key when the trimmed value is empty, so an unset ticker stays absent rather than `''`). A short helper note: "the market symbol for live prices, e.g. SAP.DE or AAPL — leave blank if you don't want live pricing."
- No validation beyond trim (ticker is optional).

- [ ] **Step 1:** Add the type field and wire the editor input + save.
- [ ] **Step 2:** `npm run build` (clean) and `npm run test` (199 still pass).
- [ ] **Step 3:** Commit.

```bash
git add src/types/index.ts src/components/account/SchemesSection.tsx
git commit -m "feat: per-scheme ticker for live pricing (#9)"
```

---

## Task 2: Drive Shares live-price from scheme config, drop SAP hard-defaults (#9)

**Files:**
- Modify: `src/screens/SharesScreen.tsx`

**Interfaces:**
- Consumes: `ShareSchemeConfig.ticker` (Task 1).

Read `src/screens/SharesScreen.tsx` fully first. Today it hardcodes `DEFAULT_SYMBOL = 'SAP.DE'`, `DEFAULT_NATIVE_CCY = 'EUR'`, and reads `profile?.schemes[0]` for currency; the price symbol comes from `storage.getPriceSymbol(profileId) || DEFAULT_SYMBOL`.

Requirements:
- **Choose the scheme to price from config, not `[0]`+SAP:** pick the first `active` scheme that has a `ticker` (fall back to the first scheme with a ticker, else none). Call it `pricingScheme`.
- **Symbol** = `pricingScheme?.ticker` ?? the stored per-profile symbol (`storage.getPriceSymbol(profileId)`) — **remove `DEFAULT_SYMBOL='SAP.DE'` as a fallback.** If there is no ticker and no stored symbol, do NOT fetch a live price; instead show a plain-English note in the price area: "Add a ticker to your share scheme (Account → Schemes) to see live prices." Live pricing is then simply off — the CGT/cost-basis figures do not depend on it.
- **Native currency** = `pricingScheme?.currency` ?? `REFERENCE_CCY` (`'GBP'`) — **remove `DEFAULT_NATIVE_CCY='EUR'`** as a hard default. (A scheme always has a currency now — it's required in the editor — so this mainly guards the no-scheme case.)
- **Keep `DEFAULT_PROXY_URL`** as the transport default (it is a generic proxy, not a scheme value) — the proxy URL is not the thing #9 is about.
- Price settings (the manual symbol override) stays as-is, but its default/placeholder should no longer be `SAP.DE` — leave the field blank/placeholder-only when there's no ticker, and when saving continue to store whatever the user types.
- Everything else (manual price, GBP reference conversion, sell calculator) keeps working off the same `effectivePrice`/`fx` variables.

- [ ] **Step 1:** Replace the SAP-constant pricing logic with scheme-config-driven logic; add the "add a ticker" empty state for live price.
- [ ] **Step 2:** `npm run build` (clean) and `npm run test` (199 pass).
- [ ] **Step 3:** Commit.

```bash
git add src/screens/SharesScreen.tsx
git commit -m "feat: drive live price from per-scheme ticker/currency, drop SAP defaults (#9)"
```

---

## Task 3: Remove the unused `ProjectionInput.today` (#8)

**Files:**
- Modify: `src/lib/projection.ts`
- Modify: `src/lib/projection.test.ts`
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/screens/IncomeScreen.tsx`

`ProjectionInput.today` is never read inside `projectTaxYear` (months elapsed comes from the latest payslip's `taxPeriod`). Rather than leave a dead field, remove it.

Requirements:
- Remove `today: Date` from the `ProjectionInput` interface and any destructuring in `projection.ts`.
- Remove `today: new Date()` from the `projectTaxYear({...})` calls in `DashboardScreen.tsx` and `IncomeScreen.tsx`.
- Remove `today` from the test helper's input builder in `projection.test.ts`. All projection tests must still pass unchanged otherwise.

- [ ] **Step 1:** Remove the field and all four call sites/usages.
- [ ] **Step 2:** `npm run build` (clean) and `npm run test` (199 pass).
- [ ] **Step 3:** Commit.

```bash
git add src/lib/projection.ts src/lib/projection.test.ts src/screens/DashboardScreen.tsx src/screens/IncomeScreen.tsx
git commit -m "refactor: drop unused ProjectionInput.today (#8)"
```

---

## Task 4: Estimate-presentation polish on Dashboard & Income (#8)

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/screens/IncomeScreen.tsx`

Requirements (all cosmetic/plain-English; no logic change):
- **Dashboard** projected panel: the "Projected income" `StatCard` currently uses `variant="default"` (cream, reads as confirmed). Change it to `variant="yellow"` so all three projected cards share the estimate treatment.
- **Dashboard** "Projected tax + NI" card: add a `note` prop containing a plain-English gloss for "NI" via `JargonTip` (term "NI", explanation e.g. "National Insurance — a separate tax on earnings that funds the state pension and benefits."). Keep the label text as-is.
- **Income** screen: when `period === 'projected'`, the "YTD" badge in the Income-sources card header and the "· year to date" text in the subheader are misleading. Make them period-aware — show "Projected" (or hide the YTD badge) when the projected period is active; keep "Year to date" for the YTD period. The "This month" note already exists.
- **Income** `ForecastSlider`: it is seeded from the projected base regardless of period. Add a one-line caption under/near it noting the baseline is your projected full-year income (an estimate) — so the "what if" is clearly built on an estimate.

- [ ] **Step 1:** Apply the four edits.
- [ ] **Step 2:** `npm run build`, `npm run test` (199 pass).
- [ ] **Step 3:** Commit.

```bash
git add src/screens/DashboardScreen.tsx src/screens/IncomeScreen.tsx
git commit -m "polish: consistent estimate treatment + NI gloss + period-aware income labels (#8)"
```

---

## Task 5: MoreDrawer accessibility (#8)

**Files:**
- Modify: `src/components/layout/MoreDrawer.tsx`

The drawer is currently a bare overlay. Add standard modal behaviour.

Requirements:
- Add `role="dialog"` and `aria-modal="true"` (and an `aria-label="More menu"`) to the sliding panel.
- **Escape closes** the drawer: a `useEffect` (only while `open`) adds a `keydown` listener calling `onClose` on `Escape`, removed on cleanup.
- **Body scroll lock** while open: in the same or a second `useEffect`, set `document.body.style.overflow = 'hidden'` on open and restore it on cleanup.
- Keep hooks unconditional (declare the effects before the `if (!open) return null` early return, and gate their behaviour on `open` inside the effect) so React hook order is stable.
- Behaviour otherwise unchanged; the existing tests must still pass (they render with `open`).

- [ ] **Step 1:** Add the effects + ARIA attributes (mind the hooks-before-early-return rule).
- [ ] **Step 2:** `npm run build`, `npm run test` (199 pass; existing MoreDrawer tests must stay green).
- [ ] **Step 3:** Commit.

```bash
git add src/components/layout/MoreDrawer.tsx
git commit -m "a11y: MoreDrawer is a dialog with Escape-to-close and scroll lock (#8)"
```

---

## Task 6: Future income events — edit in place (#8)

**Files:**
- Modify: `src/components/account/FutureEventsSection.tsx`

Today an event can only be added or removed; correcting one means delete + re-add. Add edit.

Requirements:
- Each listed event gets an **Edit** control that loads its values into the add/edit form (type, label, amount, effective date), switching the form's button to "Save changes" and showing a "Cancel" that returns to add mode.
- Saving an edit **replaces** that event in the array (matched by `id`), preserving its `id` and `taxYear`; adding still appends a new one. Persist the full array via the existing `onSave`.
- Reuse the existing validation exactly (the `parseMoney` amount check that rejects blank/zero, and the in-tax-year `effectiveDate` range check added in Plan 9). Editing must not bypass them.
- Keep the pay-rise "new annual salary" helper wording.

- [ ] **Step 1:** Add edit-in-place (an `editingId` state; the form seeds from the event being edited; save replaces vs appends).
- [ ] **Step 2:** `npm run build`, `npm run test` (199 pass).
- [ ] **Step 3:** Commit.

```bash
git add src/components/account/FutureEventsSection.tsx
git commit -m "feat: edit future income events in place, not just add/remove (#8)"
```

---

## Task 7: Component tests for the untested account sections (#8)

**Files:**
- Create: `src/components/account/PayslipSection.test.tsx`
- Create: `src/components/account/SchemesSection.test.tsx`
- Create: `src/components/account/FeedbackForm.test.tsx`

The Plan 9 final review flagged these three as untested despite carrying safety-critical logic. Add focused render-and-interact tests, mirroring the style of `src/components/account/ProfileSection.test.tsx` and `FutureEventsSection.test.tsx` (pass props directly, `vi.fn()` callbacks, do NOT mock hooks).

Read each component first for exact labels/roles, then cover:

- **PayslipSection**: (a) editing a numeric field to garbage (`1.2.3`) and saving shows an error and does NOT call `onSave`; (b) a valid edit calls `onSave` once with an **immutably** updated tax year whose target payslip has the new value and whose `rawExtracted` is preserved; (c) a non-integer/out-of-range tax period is rejected; (d) with no payslips, the empty-state (pointer to Documents) renders instead of an editor.
- **SchemesSection**: (a) saving a scheme with a blank currency shows the "needs a currency" error and does NOT call `onSave`; (b) the discount-% field appears only for `espp-discounted`; (c) entering `15` as the percent saves `discountRate: 0.15` on the scheme (verify via the `onSave` argument); (d) `onSave` is called with `{ ...profile, schemes }` preserving `pinHash`/`pinSalt`.
- **FeedbackForm**: (a) `open={false}` renders nothing; (b) Send is disabled for empty/whitespace-only text; (c) with no PAT/repo configured, sending shows the plain-English "connect your data repo" error and does not throw. (Do not attempt a real network write — with no PAT the code path short-circuits before the client call.)

If any test reveals a real bug, STOP and report it rather than weakening the test.

- [ ] **Step 1:** Write the three test files.
- [ ] **Step 2:** `npx vitest run src/components/account/PayslipSection.test.tsx src/components/account/SchemesSection.test.tsx src/components/account/FeedbackForm.test.tsx` (all pass), then `npm run test` (199 + new).
- [ ] **Step 3:** Commit.

```bash
git add src/components/account/PayslipSection.test.tsx src/components/account/SchemesSection.test.tsx src/components/account/FeedbackForm.test.tsx
git commit -m "test: cover PayslipSection, SchemesSection and FeedbackForm (#8)"
```

---

## Task 8: Save returns the new sha (remove the stale-sha window) (#8)

**Files:**
- Modify: `src/lib/github.ts`
- Modify: `src/hooks/useProfile.ts`
- Modify: `src/hooks/useTaxYear.ts`
- Modify: `src/hooks/useFutureEvents.ts`
- Modify: `src/lib/dataRepo.test.ts`

Two Account sections (`ProfileSection`, `SchemesSection`) both save `profile.json`. Today each hook, after a save, bumps a `tick` to refetch — leaving a brief window where a second save sends a stale `sha` and the GitHub API 409s ("check your connection"). Fix by having `writeFile` return the new sha and having the hooks store it directly.

Requirements:
- `GitHubDataClient.writeFile` returns `Promise<string | undefined>` — the new file sha from `createOrUpdateFileContents` (`res.data.content?.sha`). (The `dataRepo.ts` write wrappers already `return client.writeFile(...)`, so their return type follows automatically — no change needed there.)
- In `useProfile`/`useTaxYear`/`useFutureEvents`: in the `save*` callback, capture the returned sha and `setSha(newSha ?? null)` **instead of** bumping `tick`. Keep the optimistic local `setState(updated)` that already happens. `refetch()` keeps using `tick`. This removes the post-save refetch entirely, so a subsequent save uses the fresh sha immediately.
- Add a `dataRepo.test.ts` assertion (or extend an existing write test) that `writeFile` returning a sha is propagated by a write wrapper — mock the client's `writeFile` to resolve `'newsha'` and assert the wrapper resolves it.
- **Verify no regression:** the existing hook consumers don't read the `save*` return value, so returning a sha is backwards-compatible.

- [ ] **Step 1:** Return the sha from `writeFile`; update the three hooks to `setSha` from the save result; add the dataRepo test.
- [ ] **Step 2:** `npm run build` (clean) and `npm run test` (199 + 1).
- [ ] **Step 3:** Commit.

```bash
git add src/lib/github.ts src/hooks/useProfile.ts src/hooks/useTaxYear.ts src/hooks/useFutureEvents.ts src/lib/dataRepo.test.ts
git commit -m "fix: save returns the new sha so consecutive saves don't 409 on a stale sha (#8)"
```

---

## Task 9: Deploy to staging + verify

**Files:** none.

- [ ] **Step 1:** `git status -s` (clean) then `git push origin dev`.
- [ ] **Step 2:** `gh run watch $(gh run list --branch dev --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
- [ ] **Step 3:** Comment and close the issues:

```bash
gh issue comment 9 --body "Shipped to dev/staging: schemes carry an optional ticker; the Share Schemes screen now drives live pricing from the active scheme's ticker + currency (no SAP.DE/EUR hard defaults). No ticker set -> a plain-English prompt to add one, and live pricing is simply off; CGT/cost-basis figures never depended on it. Set your scheme's ticker in Account -> Schemes."
gh issue close 9 --reason completed
gh issue comment 8 --body "Polish pass shipped to dev/staging: consistent estimate (yellow) treatment on the Dashboard projected cards + an NI gloss; period-aware Income labels + a ForecastSlider estimate caption; dropped the unused ProjectionInput.today; MoreDrawer is now a dialog with Escape-to-close and body-scroll lock; future income events are editable in place; component tests added for PayslipSection/SchemesSection/FeedbackForm; and saves now return the new sha so consecutive saves to the same file don't 409 on a stale sha."
gh issue close 8 --reason completed
```

Leave #3/#4/#5 open (they close on the user's device confirmation).

---

## Self-review notes

- **#9 coverage:** ticker field + editor → Task 1; scheme-driven pricing, SAP defaults removed → Task 2. No new hardcoding — the proxy URL (generic transport) is the only retained default.
- **#8 coverage:** projected-estimate consistency + NI gloss + period-aware labels + forecaster caption → Task 4; unused `today` → Task 3; MoreDrawer a11y → Task 5; edit-in-place future events → Task 6; the three missing component test files → Task 7; stale-sha save window → Task 8.
- **Deliberately not done (documented as acceptable):** `exchange`/`broker` non-empty validation (display-only, no consumer); ESPP lookback-discount modelling (needs a product decision); a multi-scheme price *selector* on the Shares screen (Task 2 auto-picks the active ticker'd scheme — a manual selector is a later enhancement if a user runs two live-priced schemes at once).
- **Risk note:** Task 8 changes the save→sha flow used by every editable screen. It is backwards-compatible (no caller reads the return today) and covered by the final whole-branch review + the user's end-to-end save testing. If the whole-branch review finds any save regression, fix before deploy.
