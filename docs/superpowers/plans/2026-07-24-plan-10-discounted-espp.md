# Plan 10: Flexible discounted-ESPP support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user with a discounted-purchase ESPP (e.g. Gemma — ~15% discount, USD) get the tax right: the discount is recorded as taxable income at purchase, and the CGT cost basis is the **full market value** at purchase, not the discounted price paid. Because broker export formats vary, add a **manual "Add lot" form** with currency/FX so any scheme can be entered without an importer.

**Architecture:** A pure `buildManualLot()` computes a `ShareLot` (and the taxable discount/vest income) from manual inputs for every scheme type — the tax heart, fully unit-tested. A form on the Share Schemes screen calls it and appends to the lot register via the existing `writeShareLots`. The existing Section-104 CGT engine is **unchanged** — it is already cost-basis-driven and scheme-agnostic, so correct lots make it correct automatically.

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Tailwind v4, Lucide, Vitest. Reuses `src/lib/cgt.ts`, `src/lib/dataRepo.ts` (`readShareLots`/`writeShareLots`), `src/lib/money.ts` (`parseMoney`), `src/screens/SharesScreen.tsx`, `src/components/shares/LotTable.tsx`.

## Global Constraints

- Work on branch `dev`. Never commit to `main`.
- Commit with **explicit file paths** — never `git add -A` / `git add .` / `git commit -am`.
- No emojis — Lucide icons only. Tailwind design tokens only (no inline hex). Strict TS.
- **Plain English first** — every layman-facing tax term needs a `JargonTip`.
- Never fabricate figures — reject invalid input (via `parseMoney`), never coerce to 0. Missing data → explicit empty state.
- **CGT uses the FX rate on the acquisition date (historical), not today's rate** (CLAUDE.md). The form must ask for the acquisition-date FX rate; do not silently use the live rate.
- Run `npm run test` (currently **182**) and `npm run build` before every commit.

---

## Background — the tax rules (from CLAUDE.md)

| Scheme type | Income tax at acquisition | CGT cost basis |
|---|---|---|
| `espp-discounted` | on the **discount value** (market − price paid) | **market value** at purchase |
| `espp-match` | employer match via PAYE | market value at purchase |
| `rsu` | **full market value** at vest, via PAYE | market value at vest |

The income at acquisition is normally run through **PAYE by the employer** (it appears in the payslip's YTD gross), so this plan does **not** re-add it to income tax — that would double-count. Its purpose here is (a) to set the correct CGT cost basis and (b) to record/display the taxable amount for reference and Self-Assessment.

---

## File structure

```
src/
├── types/index.ts                          MODIFY — ShareLot.taxableIncomeGBP?
├── lib/
│   ├── lotBuilder.ts                        NEW — pure buildManualLot()
│   └── lotBuilder.test.ts                   NEW — unit tests (the tax heart)
├── components/shares/
│   ├── AddLotForm.tsx                        NEW — manual lot entry with FX
│   └── LotTable.tsx                          MODIFY — show taxable income column
└── screens/SharesScreen.tsx                 MODIFY — render AddLotForm, append + save lots
```

---

## Task 1: `ShareLot.taxableIncomeGBP` + pure `buildManualLot`

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/lotBuilder.ts`
- Test: `src/lib/lotBuilder.test.ts`

**Interfaces:**
- Produces: `ManualLotInput`, `BuiltLot`, `buildManualLot(input): BuiltLot`; `ShareLot` gains `taxableIncomeGBP?: number`.

- [ ] **Step 1: Add the type field** — in `src/types/index.ts`, in the `ShareLot` interface, after `incomeTaxPaidGBP?`:

```ts
  taxableIncomeGBP?: number  // income realised at acquisition (ESPP discount / RSU vest value); taxed via PAYE, recorded for CGT basis + SA reference
```

- [ ] **Step 2: Write the failing tests** — `src/lib/lotBuilder.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildManualLot, type ManualLotInput } from './lotBuilder'

const base: ManualLotInput = {
  schemeId: 's1', employerName: 'Acme Inc', schemeType: 'espp-discounted',
  acquisitionDate: '2025-09-04', quantity: 100, marketPricePerShare: 200,
  discountRate: 0.15, fxToGBP: 0.79,
}

describe('buildManualLot', () => {
  it('sets the CGT cost basis to the full GBP market value, not the discounted price paid', () => {
    const { lot } = buildManualLot(base)
    // 100 * 200 * 0.79 = 15800
    expect(lot.costBasisGBP).toBeCloseTo(15800, 2)
  })

  it('records the discount as taxable income (market x rate x fx x qty)', () => {
    const { lot, taxableIncomeGBP } = buildManualLot(base)
    // 200 * 0.15 * 0.79 * 100 = 2370
    expect(taxableIncomeGBP).toBeCloseTo(2370, 2)
    expect(lot.taxableIncomeGBP).toBeCloseTo(2370, 2)
  })

  it('reports the price actually paid (market value minus the discount)', () => {
    const { pricePaidGBP } = buildManualLot(base)
    expect(pricePaidGBP).toBeCloseTo(15800 - 2370, 2)
  })

  it('converts the per-share price to GBP via the acquisition-date FX rate', () => {
    const { lot } = buildManualLot(base)
    expect(lot.acquisitionPriceGBP).toBeCloseTo(200 * 0.79, 4)
    expect(lot.acquisitionPriceOriginal).toBe(200)
    expect(lot.acquisitionPriceFX).toBe(0.79)
  })

  it('treats an RSU vest as fully taxable at market value', () => {
    const { lot, taxableIncomeGBP } = buildManualLot({ ...base, schemeType: 'rsu', discountRate: undefined })
    expect(lot.costBasisGBP).toBeCloseTo(15800, 2)
    expect(taxableIncomeGBP).toBeCloseTo(15800, 2)
  })

  it('records no discount income for an employer-match ESPP', () => {
    const { lot, taxableIncomeGBP } = buildManualLot({ ...base, schemeType: 'espp-match', discountRate: undefined })
    expect(lot.costBasisGBP).toBeCloseTo(15800, 2)
    expect(taxableIncomeGBP).toBe(0)
    expect('taxableIncomeGBP' in lot).toBe(false)
  })

  it('is a no-op FX (rate 1) for a GBP scheme', () => {
    const { lot } = buildManualLot({ ...base, fxToGBP: 1 })
    expect(lot.costBasisGBP).toBeCloseTo(20000, 2)
    expect(lot.acquisitionPriceGBP).toBe(200)
  })

  it('carries the scheme metadata onto the lot', () => {
    const { lot } = buildManualLot(base)
    expect(lot.schemeId).toBe('s1')
    expect(lot.schemeType).toBe('espp-discounted')
    expect(lot.employerName).toBe('Acme Inc')
    expect(lot.acquisitionDate).toBe('2025-09-04')
    expect(lot.quantity).toBe(100)
    expect(typeof lot.id).toBe('string')
    expect(lot.disposalDate).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/lotBuilder.test.ts`
Expected: FAIL — module `./lotBuilder` not found.

- [ ] **Step 4: Write the implementation** — `src/lib/lotBuilder.ts`:

```ts
import type { ShareLot, SchemeType } from '../types'

export interface ManualLotInput {
  schemeId: string
  employerName: string
  schemeType: SchemeType
  acquisitionDate: string        // ISO yyyy-mm-dd
  quantity: number
  marketPricePerShare: number    // in the scheme currency, at acquisition
  discountRate?: number          // fraction (0.15 = 15%), for espp-discounted; taken from the scheme config
  fxToGBP: number                // scheme currency -> GBP rate ON THE ACQUISITION DATE (1 for GBP)
}

export interface BuiltLot {
  lot: ShareLot
  marketValueGBP: number         // = costBasisGBP; the full value the CGT basis uses
  taxableIncomeGBP: number       // discount (espp-discounted) / full vest value (rsu) / 0
  pricePaidGBP: number           // what the holder actually paid, for information
}

/**
 * Build a ShareLot from manually-entered figures for any scheme type.
 *
 * The CGT cost basis is always the FULL market value at acquisition (in GBP at
 * the acquisition-date FX rate). For a discounted ESPP the discount is recorded
 * as taxable income (taxed via PAYE at purchase); for an RSU the whole market
 * value is the taxable-at-vest income. Employer-match ESPP records no discount
 * income here (the match is handled through PAYE).
 */
export function buildManualLot(input: ManualLotInput): BuiltLot {
  const { schemeType, quantity, marketPricePerShare, fxToGBP } = input
  const marketPerShareGBP = marketPricePerShare * fxToGBP
  const marketValueGBP = marketPerShareGBP * quantity

  let taxableIncomeGBP = 0
  let pricePaidGBP = marketValueGBP

  if (schemeType === 'espp-discounted') {
    const rate = input.discountRate ?? 0
    taxableIncomeGBP = marketPerShareGBP * rate * quantity
    pricePaidGBP = marketValueGBP - taxableIncomeGBP
  } else if (schemeType === 'rsu') {
    taxableIncomeGBP = marketValueGBP
    pricePaidGBP = 0
  }

  const lot: ShareLot = {
    id: crypto.randomUUID(),
    schemeId: input.schemeId,
    employerName: input.employerName,
    schemeType,
    acquisitionDate: input.acquisitionDate,
    acquisitionPriceOriginal: marketPricePerShare,
    acquisitionPriceFX: fxToGBP,
    acquisitionPriceGBP: marketPerShareGBP,
    quantity,
    costBasisGBP: marketValueGBP,
    ...(taxableIncomeGBP > 0 ? { taxableIncomeGBP } : {}),
  }

  return { lot, marketValueGBP, taxableIncomeGBP, pricePaidGBP }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/lotBuilder.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Full suite + build, then commit**

Run: `npm run test` (expect 182 + 8 = 190) and `npm run build` (clean).

```bash
git add src/types/index.ts src/lib/lotBuilder.ts src/lib/lotBuilder.test.ts
git commit -m "feat: buildManualLot — discounted-ESPP cost basis + discount income with FX (#5)"
```

---

## Task 2: Manual "Add lot" form

**Files:**
- Create: `src/components/shares/AddLotForm.tsx`
- Modify: `src/screens/SharesScreen.tsx`

**Interfaces:**
- Consumes: `buildManualLot` (Task 1), `parseMoney` (`src/lib/money.ts`), types `Profile`, `ShareLot`, `ShareSchemeConfig`.
- Produces: `AddLotForm` with props `{ schemes: ShareSchemeConfig[]; onAdd: (lot: ShareLot) => Promise<void> }`.

Requirements:
- If `schemes` is empty, render a plain-English prompt to add a scheme first (link/pointer to Account → schemes) — do not render an unusable form.
- A **scheme select** (by `employerName` + type). The selected scheme provides `schemeType`, `discountRate`, `currency`.
- Fields: acquisition date (`<input type="date">`), quantity (numeric), market price per share **in the scheme's currency** (numeric — show the currency code as an adornment/label), and **FX rate to GBP on the acquisition date** (numeric, default `1` and hidden/disabled when the scheme currency is `GBP`, otherwise required with a `JargonTip` explaining it must be the rate on the purchase date, not today's).
- Validate every numeric field with `parseMoney` (reject non-numeric / blank with a visible error; quantity and market price must be `> 0`; FX must be `> 0`).
- **Live preview** before adding: show the computed **GBP cost basis** and, for `espp-discounted`/`rsu`, the **taxable income** — each clearly labelled, using `buildManualLot` (do NOT recompute inline). Include a one-line note that the income is normally taxed via PAYE at purchase and that the cost basis is what CGT uses when the shares are sold.
- On **Add**: call `buildManualLot({ schemeId: scheme.id, employerName: scheme.employerName, schemeType: scheme.schemeType, discountRate: scheme.discountRate, acquisitionDate, quantity, marketPricePerShare, fxToGBP })`, then `await onAdd(built.lot)`. Show adding/added/error states; clear the numeric fields on success.
- `JargonTip` for "cost basis" and "ESPP".

In `SharesScreen.tsx`: render `<AddLotForm schemes={profile?.schemes ?? []} onAdd={handleAddLot} />` near the lot register / import area. `handleAddLot(lot)` appends to the current `lots`, persists with the existing `writeShareLots(getDataClient(pat, repo), profileId, nextLots, sha)` pattern (mirror `handleImport`), and updates `lots`/`sha` state. If dev-seed is active (`isDevSeedActive()`), saving is disabled elsewhere — follow the existing guard so the form doesn't attempt a write in seed mode (show the seed note the screen already uses).

- [ ] **Step 1: Build the form and wire it in.**
- [ ] **Step 2: Verify** — `npm run build` (clean) and `npm run test` (all pass).
- [ ] **Step 3: Commit**

```bash
git add src/components/shares/AddLotForm.tsx src/screens/SharesScreen.tsx
git commit -m "feat: manual Add-lot form with currency/FX for any scheme (#5)"
```

---

## Task 3: Show taxable income in the lot register

**Files:**
- Modify: `src/components/shares/LotTable.tsx`

**Interfaces:**
- Consumes: `ShareLot.taxableIncomeGBP` (Task 1).

Requirements:
- Add a **"Taxable income"** column showing `taxableIncomeGBP` (blank/`—` when absent). Keep the existing columns.
- Add a short footnote under the table (or a header tooltip) explaining in plain English: this is the ESPP discount / RSU vest value that was taxed as income at acquisition (usually via PAYE), and it's why the CGT cost basis is the full market value.
- Keep the table horizontally scrollable (it already wraps in `overflow-x-auto`).

- [ ] **Step 1: Add the column + note.**
- [ ] **Step 2: Verify** — `npm run build`, `npm run test`.
- [ ] **Step 3: Commit**

```bash
git add src/components/shares/LotTable.tsx
git commit -m "feat: show taxable ESPP-discount / RSU-vest income in the lot register (#5)"
```

---

## Task 4: Deploy to staging + verify

**Files:** none.

- [ ] **Step 1: Push** — `git status -s` (clean) then `git push origin dev`.
- [ ] **Step 2: Confirm the staging deploy is green** — `gh run watch $(gh run list --branch dev --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
- [ ] **Step 3: Comment on issue #5**

```bash
gh issue comment 5 --body "Discounted-ESPP support shipped to dev/staging. Any scheme's lots can now be entered manually with currency/FX (no importer needed): the CGT cost basis is set to the full market value at purchase and the discount is recorded as taxable income (taxed via PAYE). buildManualLot handles espp-discounted / espp-match / rsu; the Section-104 CGT engine was already cost-basis-driven so needs no change. To enter Gemma's actual holdings: create her espp-discounted scheme (Account → schemes, ~15%, USD), then use Add lot on Share Schemes with the acquisition-date USD->GBP rate."
```

Leave #5 open until Gemma's real data is entered and confirmed on device.

---

## Self-review notes

- **Spec coverage (Feature 6):** discounted-ESPP income tax on the discount + CGT cost basis = market value → Task 1 (`buildManualLot`); FX machinery for USD → Task 1 (`fxToGBP`) + Task 2 (form FX field); user-editable/flexible (no hardcoding) → the scheme config drives `schemeType`/`discountRate`/`currency` (built in Plan 9), and Task 2 reads them. Gemma's specifics remain pure data entry.
- **Deliberate scope boundary:** the discount/vest income is NOT re-added to income tax (it's PAYE'd at source — re-adding would double-count); it's recorded (`taxableIncomeGBP`) for CGT basis and SA reference and displayed in the register. If a future scheme's income is genuinely outside PAYE, feeding it into the income summary is a separate change.
- **No CGT engine change:** `cgt.ts` is cost-basis-driven and untouched; correct lots make disposals correct automatically. The existing SAP XLSX importer is left as-is (SAP-specific); manual entry is the universal path.
- **Type consistency:** `buildManualLot(input: ManualLotInput): BuiltLot`; `ShareLot.taxableIncomeGBP?` used in Tasks 1/2/3.
- **No new hardcoding (explicit design goal).** Every scheme-specific value — type, discount rate, currency, employer — comes from the user-editable scheme config or the manual inputs, never from a literal in this plan's code. The design is job-change-proof by construction: a new employer/scheme is data entry, not a code change.
- **Pre-existing hardcoding flagged for follow-up (out of scope here):** `SharesScreen.tsx` keeps SAP-centric defaults from the ticker work — `DEFAULT_SYMBOL = 'SAP.DE'`, `DEFAULT_NATIVE_CCY = 'EUR'`, `DEFAULT_PROXY_URL`, and a single-scheme `schemes[0]` assumption for live pricing. This affects the *live current-value* display for a non-SAP scheme (e.g. Gemma's USD holding defaults to SAP's price until overridden in Price settings), NOT the CGT/cost-basis logic this plan fixes. The future-proof fix is a per-scheme `ticker`/`currency` on `ShareSchemeConfig` driving live price, and multi-scheme support on the Shares screen — tracked as its own issue, not smuggled into this plan.
```
