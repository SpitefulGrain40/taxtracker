import type { TaxYear, Payslip } from '../types'

export interface PayslipEditForm {
  ytdGross: number
  ytdTaxPaid: number
  ytdEmployeeNI: number
  basicSalary: number
  taxPaid: number
  employeeNI: number
  taxCode: string
  taxPeriod: number
}

export interface LatestPayslipRef {
  employmentId: string
  payslip: Payslip
}

/**
 * Find the payslip with the highest taxPeriod across all employments — the
 * same "latest" payslip that summariseTaxYear (src/lib/incomeSummary.ts) uses
 * to drive the Dashboard. Edits must target this exact payslip so corrections
 * actually change what the rest of the app shows. Ties keep the
 * earliest-encountered payslip, matching summariseTaxYear's reduce order.
 */
export function findLatestPayslip(taxYear: TaxYear): LatestPayslipRef | null {
  let best: LatestPayslipRef | null = null
  for (const employment of taxYear.employment) {
    for (const payslip of employment.payslips) {
      if (!best || payslip.taxPeriod > best.payslip.taxPeriod) {
        best = { employmentId: employment.id, payslip }
      }
    }
  }
  return best
}

/**
 * Merge edited fields into a single payslip, rebuilding the employment/payslip
 * arrays immutably (a prior bug in this codebase — commit d753f28 — came from
 * mutating these arrays in place). Every field not present in `edits`
 * (rawExtracted in particular, the audit trail of the original AI extraction)
 * survives untouched. The original taxYear object and its nested arrays are
 * never mutated.
 */
export function applyPayslipEdits(
  taxYear: TaxYear,
  employmentId: string,
  payslipId: string,
  edits: PayslipEditForm
): TaxYear {
  return {
    ...taxYear,
    employment: taxYear.employment.map(employment =>
      employment.id === employmentId
        ? {
            ...employment,
            payslips: employment.payslips.map(payslip =>
              payslip.id === payslipId ? { ...payslip, ...edits } : payslip
            ),
          }
        : employment
    ),
  }
}
