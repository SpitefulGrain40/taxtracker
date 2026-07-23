import type { TaxYear, FutureIncomeEvent } from '../types'
import type { TaxRates } from './taxRates'
import {
  incomeTax, employeeNI, effectivePersonalAllowance, parseTaxCode, marginalBand,
  dividendTaxStacked, savingsTaxStacked, type Band,
} from './taxCalc'
import { summariseTaxYear } from './incomeSummary'
import { getTaxPeriod } from './taxYears'

export interface ProjectionInput {
  taxYear: TaxYear
  events: FutureIncomeEvent[]
  baseAnnualSalary: number | null
  taxCode: string | null
  today: Date
  rates: TaxRates
}

export interface TaxProjection {
  available: boolean
  projectedGross: number     // projected annual employment gross (incl. one-offs)
  projectedTaxDue: number    // total income tax + NI + dividend + savings tax
  projectedPAYE: number      // estimated PAYE withheld over the year
  shortfall: number          // projectedTaxDue - projectedPAYE (>0 = set aside)
  band: Band
  monthsElapsed: number
  usedStatedSalary: boolean
  assumptions: string[]
}

function latestPayslip(ty: TaxYear) {
  const all = ty.employment.flatMap(e => e.payslips)
  if (all.length === 0) return null
  return all.reduce((a, p) => (p.taxPeriod > a.taxPeriod ? p : a), all[0])
}

export function projectTaxYear(input: ProjectionInput): TaxProjection {
  const { taxYear, events, baseAnnualSalary, taxCode, rates } = input
  const latest = latestPayslip(taxYear)

  if (!latest) {
    return {
      available: false, projectedGross: 0, projectedTaxDue: 0, projectedPAYE: 0,
      shortfall: 0, band: 'basic', monthsElapsed: 0, usedStatedSalary: false,
      assumptions: ['No payslip yet — add one to project your year-end position.'],
    }
  }

  const m = latest.taxPeriod
  const ytdGross = latest.ytdGross
  const usedStatedSalary = baseAnnualSalary != null
  const monthlyForFuture = usedStatedSalary ? (baseAnnualSalary as number) / 12 : ytdGross / m

  const yearEvents = events.filter(e => e.taxYear === taxYear.key)
  const payRises = yearEvents.filter(e => e.type === 'pay-rise')
  const oneOffs = yearEvents.filter(e => e.type === 'bonus' || e.type === 'rsu-vest')

  // Future employment run-rate, stepping at each pay-rise effective period.
  let futureGross = 0
  for (let p = m + 1; p <= 12; p++) {
    const active = payRises
      .filter(e => getTaxPeriod(new Date(e.effectiveDate)) <= p)
      .sort((a, b) => getTaxPeriod(new Date(a.effectiveDate)) - getTaxPeriod(new Date(b.effectiveDate)))
    futureGross += active.length ? active[active.length - 1].amount / 12 : monthlyForFuture
  }

  const oneOffTotal = oneOffs.reduce((s, e) => s + e.amount, 0)
  const oneOffNoNI = oneOffs.filter(e => e.subjectToNI === false).reduce((s, e) => s + e.amount, 0)
  const projectedGross = ytdGross + futureGross + oneOffTotal
  const niBase = projectedGross - oneOffNoNI

  const summary = summariseTaxYear(taxYear)
  const { dividendIncome: dividends, savingsIncome: savings, benefitsInKind: benefits } = summary

  const totalForTaper = projectedGross + benefits + dividends + savings
  const codeAllowance = taxCode ? parseTaxCode(taxCode).allowance : null
  const allowance = codeAllowance ?? effectivePersonalAllowance(totalForTaper, rates)

  const employmentForTax = projectedGross + benefits
  const incomeTaxDue = incomeTax(employmentForTax, allowance, rates)
  const niDue = employeeNI(niBase, rates)
  const savingsTaxDue = savingsTaxStacked(savings, employmentForTax, allowance, rates)
  const dividendTaxDue = dividendTaxStacked(dividends, employmentForTax + savings, allowance, rates)
  const projectedTaxDue = incomeTaxDue + niDue + savingsTaxDue + dividendTaxDue

  const band: Band = marginalBand(totalForTaper, rates)

  // Estimated PAYE withheld: annualise the YTD run-rate, then add PAYE on the
  // amounts added on top of that plain run-rate (pay-rise deltas + one-offs) at
  // the projected marginal rate. Dividend/savings tax is NOT withheld by PAYE,
  // so it falls through into the shortfall the user must set aside.
  const runRatePAYE = ((latest.ytdTaxPaid + latest.ytdEmployeeNI) / m) * 12
  const plainFuture = monthlyForFuture * (12 - m)
  const additions = (projectedGross - ytdGross) - plainFuture // pay-rise deltas + one-offs
  const incomeMarginal = band === 'basic' ? rates.basicRate : band === 'higher' ? rates.higherRate : rates.additionalRate
  const niMarginal = niBase > rates.niUpperEarningsLimit ? rates.niUpperRate : rates.niMainRate
  const niableAdditions = Math.max(0, additions - oneOffNoNI)
  const payeOnAdditions = additions * incomeMarginal + niableAdditions * niMarginal
  const projectedPAYE = runRatePAYE + payeOnAdditions

  const shortfall = projectedTaxDue - projectedPAYE

  const assumptions = [
    usedStatedSalary
      ? 'Future months use your stated base salary.'
      : 'Future months assume your latest payslip is a typical month.',
    'PAYE withholding is estimated from your payslips so far. Tax on dividends and savings is not taken by PAYE — that is the shortfall to set aside.',
  ]

  return {
    available: true, projectedGross, projectedTaxDue, projectedPAYE, shortfall,
    band, monthsElapsed: m, usedStatedSalary, assumptions,
  }
}
