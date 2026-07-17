import type { TaxYear } from '../types'

export interface IncomeSummary {
  employmentIncome: number
  taxPaidToDate: number
  niPaidToDate: number
  dividendIncome: number
  savingsIncome: number
  benefitsInKind: number
  taxCode: string | null
}

function latestPayslip(ty: TaxYear) {
  const all = ty.employment.flatMap(e => e.payslips)
  if (all.length === 0) return null
  return all.reduce((latest, p) => (p.taxPeriod > latest.taxPeriod ? p : latest), all[0])
}

export function summariseTaxYear(ty: TaxYear): IncomeSummary {
  const latest = latestPayslip(ty)
  return {
    employmentIncome: latest?.ytdGross ?? 0,
    taxPaidToDate: latest?.ytdTaxPaid ?? 0,
    niPaidToDate: latest?.ytdEmployeeNI ?? 0,
    dividendIncome: ty.dividends.reduce((s, d) => s + d.amount, 0),
    savingsIncome: ty.savingsInterest.reduce((s, x) => s + x.grossInterest, 0),
    benefitsInKind: ty.benefitsInKind.reduce((s, b) => s + b.taxableValue, 0),
    taxCode: latest?.taxCode ?? null,
  }
}
