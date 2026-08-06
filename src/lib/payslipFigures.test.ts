import { describe, it, expect } from 'vitest'
import { payslipPeriodFigures } from './payslipFigures'
import type { Payslip } from '../types'

function basePayslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    id: 'p1', taxPeriod: 8, taxYear: '2025-26', date: '2025-11-30',
    basicSalary: 8692.33, carAllowance: 700, otherPayments: [],
    taxPaid: 2790.90, employeeNI: 339.93, salarySacrifice: [],
    esppContribution: 260.77, employerMatch: 121.15,
    ytdGross: 68560.86, ytdTaxPaid: 23186.13, ytdEmployeeNI: 2712.00,
    taxCode: 'K289', niNumber: 'JL041798C', employerName: 'SAP UK Limited', rawExtracted: {},
    ...overrides,
  }
}

describe('payslipPeriodFigures', () => {
  it('sums basic salary, car allowance and other payments for gross', () => {
    const p = basePayslip({
      basicSalary: 5000, carAllowance: 300,
      otherPayments: [{ label: 'Bonus', amount: 500 }, { label: 'Overtime', amount: 100 }],
    })
    const f = payslipPeriodFigures(p)
    expect(f.gross).toBe(5900)
  })

  it('returns own-period tax and NI, not YTD figures', () => {
    const p = basePayslip({ taxPaid: 900, employeeNI: 200, ytdTaxPaid: 23186.13, ytdEmployeeNI: 2712 })
    const f = payslipPeriodFigures(p)
    expect(f.tax).toBe(900)
    expect(f.ni).toBe(200)
  })

  it('handles no other payments', () => {
    const p = basePayslip({ basicSalary: 4000, carAllowance: 0, otherPayments: [] })
    const f = payslipPeriodFigures(p)
    expect(f.gross).toBe(4000)
  })
})
