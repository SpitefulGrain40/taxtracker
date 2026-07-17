import { describe, it, expect } from 'vitest'
import { summariseTaxYear } from './incomeSummary'
import { emptyTaxYear } from './dataRepo'
import type { TaxYear } from '../types'

function yearWithPayslips(): TaxYear {
  const ty = emptyTaxYear('2025-26')
  ty.employment = [{
    id: 'e1',
    employerName: 'SAP UK Limited',
    payslips: [
      { id: 'p1', taxPeriod: 8, taxYear: '2025-26', date: '2025-11-30',
        basicSalary: 8692.33, carAllowance: 700, otherPayments: [],
        taxPaid: 2790.90, employeeNI: 339.93, salarySacrifice: [{label:'EE Sal Sac',amount:-869.23}],
        esppContribution: 260.77, employerMatch: 121.15,
        ytdGross: 68560.86, ytdTaxPaid: 23186.13, ytdEmployeeNI: 2712.00,
        taxCode: 'K289', niNumber: 'JL041798C', employerName: 'SAP UK Limited', rawExtracted: {} },
    ],
  }]
  ty.dividends = [{ id: 'd1', description: 'SAP', amount: 200, date: '2026-01-01', taxYear: '2025-26' }]
  ty.savingsInterest = [{ id: 's1', provider: 'Bank', grossInterest: 300, taxYear: '2025-26' }]
  return ty
}

describe('summariseTaxYear', () => {
  it('uses latest payslip YTD gross as employment income', () => {
    const s = summariseTaxYear(yearWithPayslips())
    expect(s.employmentIncome).toBeCloseTo(68560.86, 2)
    expect(s.taxPaidToDate).toBeCloseTo(23186.13, 2)
  })
  it('sums dividends and savings', () => {
    const s = summariseTaxYear(yearWithPayslips())
    expect(s.dividendIncome).toBe(200)
    expect(s.savingsIncome).toBe(300)
  })
  it('picks the latest payslip when multiple exist', () => {
    const ty = yearWithPayslips()
    ty.employment[0].payslips.push({
      ...ty.employment[0].payslips[0], id: 'p2', taxPeriod: 9, date: '2025-12-31',
      ytdGross: 77000, ytdTaxPaid: 26000,
    })
    const s = summariseTaxYear(ty)
    expect(s.employmentIncome).toBe(77000)
  })
  it('returns zeros for an empty year', () => {
    const s = summariseTaxYear(emptyTaxYear('2025-26'))
    expect(s.employmentIncome).toBe(0)
    expect(s.dividendIncome).toBe(0)
  })
  it('exposes the effective tax code from the latest payslip', () => {
    const s = summariseTaxYear(yearWithPayslips())
    expect(s.taxCode).toBe('K289')
  })
})
