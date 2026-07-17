import type { TaxRates } from './taxRates'

export type Band = 'basic' | 'higher' | 'additional'

export function effectivePersonalAllowance(totalIncome: number, r: TaxRates): number {
  if (totalIncome <= r.paTaperThreshold) return r.personalAllowance
  const reduction = Math.floor((totalIncome - r.paTaperThreshold) / 2)
  return Math.max(0, r.personalAllowance - reduction)
}

export function parseTaxCode(code: string): { allowance: number | null; kCode: boolean } {
  const upper = code.trim().toUpperCase()
  if (['BR', 'D0', 'D1', 'NT'].includes(upper)) return { allowance: null, kCode: false }
  if (upper.startsWith('K')) {
    const digits = parseInt(upper.slice(1).replace(/[^0-9]/g, ''), 10) || 0
    return { allowance: -(digits * 10), kCode: true }  // K289 → -2890
  }
  const digits = parseInt(upper.replace(/[^0-9]/g, ''), 10) || 0
  return { allowance: digits * 10, kCode: false }  // 1257L → 12570
}

export function incomeTax(income: number, allowance: number, r: TaxRates): number {
  const taxable = Math.max(0, income - allowance)
  if (taxable <= 0) return 0

  const basicBand = r.basicRateLimit                            // 37700
  const higherBandTop = r.higherRateLimit - r.personalAllowance // 125140 - 12570 = 112570

  let tax = 0
  const basic = Math.min(taxable, basicBand)
  tax += basic * r.basicRate

  if (taxable > basicBand) {
    const higher = Math.min(taxable - basicBand, higherBandTop - basicBand)
    tax += higher * r.higherRate
  }
  if (taxable > higherBandTop) {
    tax += (taxable - higherBandTop) * r.additionalRate
  }
  return tax
}

export function employeeNI(income: number, r: TaxRates): number {
  if (income <= r.niPrimaryThreshold) return 0
  const main = Math.min(income, r.niUpperEarningsLimit) - r.niPrimaryThreshold
  let ni = main * r.niMainRate
  if (income > r.niUpperEarningsLimit) {
    ni += (income - r.niUpperEarningsLimit) * r.niUpperRate
  }
  return ni
}

export function dividendTax(dividends: number, band: Band, r: TaxRates): number {
  const taxable = Math.max(0, dividends - r.dividendAllowance)
  if (taxable <= 0) return 0
  const rate = band === 'basic' ? r.dividendBasicRate : band === 'higher' ? r.dividendHigherRate : r.dividendAdditionalRate
  return taxable * rate
}

export function savingsTax(interest: number, band: Band, r: TaxRates): number {
  const psa = band === 'basic' ? r.psaBasicRate : band === 'higher' ? r.psaHigherRate : 0
  const taxable = Math.max(0, interest - psa)
  if (taxable <= 0) return 0
  const rate = band === 'basic' ? r.basicRate : band === 'higher' ? r.higherRate : r.additionalRate
  return taxable * rate
}

export function marginalBand(totalIncome: number, r: TaxRates): Band {
  if (totalIncome > r.higherRateLimit) return 'additional'
  const pa = effectivePersonalAllowance(totalIncome, r)
  if (totalIncome - pa > r.basicRateLimit) return 'higher'
  return 'basic'
}
