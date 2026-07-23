// ─── Dev-only seed ─────────────────────────────────────────────────────────────
//
// Lets you skip setup / PIN / onboarding and load the app with realistic dummy
// data, so you can iterate on screens (and prove the live-price wiring) without
// re-onboarding every time.
//
// HARD-GATED to Vite's DEV build via `import.meta.env.DEV`. Production and
// staging are built with `vite build` (DEV === false), so every export here is
// inert and tree-shaken out of those bundles. It can never bypass auth or
// fabricate data on a deployed site — it only works under `npm run dev`.
//
// Usage (local dev only):
//   http://localhost:5173/taxtracker/?seed       → turn dummy mode on
//   http://localhost:5173/taxtracker/?seed=off   → turn it back off
// The flag persists in localStorage until switched off, so you only pass it once.
//
// Note: saving is disabled in seed mode (no real GitHub repo/PAT), so writes
// will report "Not configured" — this is a read-only preview of the UI.

import type { Profile, ProfileId, ShareLot, TaxYear, TaxYearKey } from '../types'

const SEED_FLAG = 'tt_dev_seed'

/** True only in a dev build with the seed flag set. */
export function isDevSeedActive(): boolean {
  return import.meta.env.DEV && localStorage.getItem(SEED_FLAG) === '1'
}

/** Honour ?seed / ?seed=off in the URL. Call once at startup. No-op in prod. */
export function applyDevSeedFromUrl(): void {
  if (!import.meta.env.DEV) return
  const params = new URLSearchParams(window.location.search)
  if (!params.has('seed')) return
  const val = params.get('seed')
  if (val === 'off' || val === '0' || val === 'false') {
    localStorage.removeItem(SEED_FLAG)
  } else {
    localStorage.setItem(SEED_FLAG, '1')
  }
}

export function seedProfile(profileId: ProfileId): Profile {
  return {
    id: profileId,
    firstName: profileId === 'gemma' ? 'Gemma' : 'Mike',
    niNumber: 'QQ123456C',
    taxCode: 'K289',
    pinHash: '',
    pinSalt: '',
    githubPat: '',
    baseAnnualSalary: 95000,
    otherIncomeSources: ['rsu-vests', 'dividends', 'savings'],
    schemes: [
      {
        id: 'sap-espp',
        employerName: 'SAP UK Ltd',
        schemeType: 'espp-match',
        currency: 'EUR',
        exchange: 'XETRA',
        broker: 'EquatePlus',
        active: true,
      },
    ],
  }
}

export function seedTaxYear(key: TaxYearKey): TaxYear {
  const [startYear] = key.split('-')
  return {
    key,
    startDate: `${startYear}-04-06`,
    endDate: `${parseInt(startYear) + 1}-04-05`,
    employment: [
      {
        id: 'emp-sap',
        employerName: 'SAP UK Ltd',
        payslips: [
          {
            id: 'ps-1',
            taxPeriod: 4,
            taxYear: key,
            date: `${startYear}-07-25`,
            basicSalary: 7916.67,
            carAllowance: 0,
            otherPayments: [],
            taxPaid: 2450,
            employeeNI: 520,
            salarySacrifice: [{ label: 'Pension (salary sacrifice)', amount: 633.33 }],
            esppContribution: 300,
            employerMatch: 150,
            ytdGross: 42000,
            ytdTaxPaid: 9800,
            ytdEmployeeNI: 2600,
            taxCode: 'K289',
            niNumber: 'QQ123456C',
            employerName: 'SAP UK Ltd',
            rawExtracted: {},
          },
        ],
      },
    ],
    dividends: [
      { id: 'div-1', description: 'Aviva plc', amount: 800, date: `${startYear}-05-20`, taxYear: key },
    ],
    savingsInterest: [
      { id: 'sav-1', provider: 'Chase Saver', grossInterest: 1150, taxYear: key },
    ],
    benefitsInKind: [
      { id: 'bik-1', type: 'medical', description: 'Private medical (Bupa)', taxableValue: 1450, taxYear: key },
    ],
  }
}

export function seedShareLots(): ShareLot[] {
  // SAP ESPP employer-match lots, EUR-denominated (XETRA). costBasisGBP is the
  // total GBP cost of the lot (quantity × per-share GBP price at acquisition).
  const lots: Array<{ date: string; eur: number; qty: number; fx: number }> = [
    { date: '2025-04-15', eur: 215, qty: 6, fx: 0.86 },
    { date: '2025-06-16', eur: 225, qty: 6, fx: 0.85 },
    { date: '2025-09-04', eur: 238, qty: 5, fx: 0.84 },
  ]
  return lots.map((l, i) => {
    const priceGBP = Number((l.eur * l.fx).toFixed(2))
    return {
      id: `lot-${i + 1}`,
      schemeId: 'sap-espp',
      employerName: 'SAP UK Ltd',
      schemeType: 'espp-match',
      acquisitionDate: l.date,
      acquisitionPriceOriginal: l.eur,
      acquisitionPriceFX: l.fx,
      acquisitionPriceGBP: priceGBP,
      quantity: l.qty,
      costBasisGBP: Number((priceGBP * l.qty).toFixed(2)),
    }
  })
}
