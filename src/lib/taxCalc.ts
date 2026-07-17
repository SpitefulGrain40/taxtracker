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

  const basicBand = r.basicRateLimit                    // 37700
  // Additional-rate threshold expressed in TAXABLE terms uses the ACTUAL
  // allowance in force (tapered PA / K-code), not the constant PA. Using the
  // constant would push high earners with reduced allowances into 45% too early.
  const higherBandTop = r.higherRateLimit - allowance

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

/**
 * Walks tax bands for a slice of income stacked on top of `startingIncome`
 * (both expressed in TAXABLE terms). The first `allowanceWithinAmount` of the
 * amount is 0-rated but still consumes band space; the remainder is taxed at
 * the band rate for the position it occupies.
 */
function bandWalk(
  startingIncome: number,
  amount: number,
  allowanceWithinAmount: number,
  basicRate: number,
  higherRate: number,
  additionalRate: number,
  basicTop: number,
  higherTop: number,
): number {
  let pos = startingIncome
  let remaining = amount

  // 0-rated allowance (PSA / dividend allowance): consumes band space, no tax.
  const allowanceUsed = Math.min(remaining, allowanceWithinAmount)
  pos += allowanceUsed
  remaining -= allowanceUsed

  let tax = 0
  while (remaining > 0) {
    let bandTop: number
    let rate: number
    if (pos < basicTop) {
      bandTop = basicTop
      rate = basicRate
    } else if (pos < higherTop) {
      bandTop = higherTop
      rate = higherRate
    } else {
      bandTop = Infinity
      rate = additionalRate
    }
    const slice = Math.min(remaining, bandTop - pos)
    tax += slice * rate
    pos += slice
    remaining -= slice
  }
  return tax
}

/**
 * Dividend tax where dividends stack on top of `otherIncome` (employment + savings).
 * The dividend allowance (£500) is applied first (uses up band space but is 0-rated).
 * Then each slice of dividends is taxed at the dividend rate for the band it falls in.
 * `allowance` is the personal allowance in force (already computed by caller).
 */
export function dividendTaxStacked(dividends: number, otherIncome: number, allowance: number, r: TaxRates): number {
  if (dividends <= 0) return 0
  const startingIncome = Math.max(0, otherIncome - allowance)
  const higherTop = r.higherRateLimit - allowance
  return bandWalk(
    startingIncome,
    dividends,
    r.dividendAllowance,
    r.dividendBasicRate,
    r.dividendHigherRate,
    r.dividendAdditionalRate,
    r.basicRateLimit,
    higherTop,
  )
}

/**
 * Savings interest tax where interest stacks on top of `otherIncome` (employment),
 * BELOW dividends. Applies the PSA (band-dependent), then taxes each slice at the
 * income-tax rate for the band it falls in.
 */
export function savingsTaxStacked(interest: number, otherIncome: number, allowance: number, r: TaxRates): number {
  if (interest <= 0) return 0
  const startingIncome = Math.max(0, otherIncome - allowance)
  const higherTop = r.higherRateLimit - allowance
  const overallBand = marginalBand(otherIncome + interest, r)
  const psa = overallBand === 'basic' ? r.psaBasicRate : overallBand === 'higher' ? r.psaHigherRate : 0
  return bandWalk(
    startingIncome,
    interest,
    psa,
    r.basicRate,
    r.higherRate,
    r.additionalRate,
    r.basicRateLimit,
    higherTop,
  )
}
