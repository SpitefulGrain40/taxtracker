import type { Payslip } from '../types'

export interface PeriodFigures {
  gross: number
  tax: number
  ni: number
}

/** A single payslip's own-period figures (not cumulative/YTD). */
export function payslipPeriodFigures(p: Payslip): PeriodFigures {
  const gross = p.basicSalary + p.carAllowance + p.otherPayments.reduce((s, li) => s + li.amount, 0)
  return { gross, tax: p.taxPaid, ni: p.employeeNI }
}
