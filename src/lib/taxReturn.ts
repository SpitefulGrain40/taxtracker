import type { TaxYear, ShareLot } from '../types'
import type { TaxRates } from './taxRates'
import type { Band } from './taxCalc'
import { marginalBand } from './taxCalc'
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

  return {
    taxYear: ty.key,
    band,
    sections,
    readyCount,
    totalSections: relevant.length,
  }
}
