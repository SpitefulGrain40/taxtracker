export interface TaxRates {
  personalAllowance: number
  paTaperThreshold: number
  basicRateLimit: number
  higherRateLimit: number
  basicRate: number
  higherRate: number
  additionalRate: number
  niPrimaryThreshold: number
  niUpperEarningsLimit: number
  niMainRate: number
  niUpperRate: number
  dividendAllowance: number
  dividendBasicRate: number
  dividendHigherRate: number
  dividendAdditionalRate: number
  psaBasicRate: number
  psaHigherRate: number
  cgtAnnualExempt: number
  cgtBasicRate: number
  cgtHigherRate: number
}

export const RATES_2025_26: TaxRates = {
  personalAllowance: 12570,
  paTaperThreshold: 100000,
  basicRateLimit: 37700,
  higherRateLimit: 125140,
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
  niPrimaryThreshold: 12570,
  niUpperEarningsLimit: 50270,
  niMainRate: 0.08,
  niUpperRate: 0.02,
  dividendAllowance: 500,
  dividendBasicRate: 0.0875,
  dividendHigherRate: 0.3375,
  dividendAdditionalRate: 0.3935,
  psaBasicRate: 1000,
  psaHigherRate: 500,
  cgtAnnualExempt: 3000,
  cgtBasicRate: 0.18,
  cgtHigherRate: 0.24,
}

export const CURRENT_RATES = RATES_2025_26
