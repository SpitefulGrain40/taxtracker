// ─── Tax year ────────────────────────────────────────────────────────────────

export type TaxYearKey = `${number}-${number}` // e.g. "2025-26"

export interface TaxYear {
  key: TaxYearKey
  startDate: string // ISO "2025-04-06"
  endDate: string   // ISO "2026-04-05"
  employment: EmploymentIncome[]
  dividends: DividendEntry[]
  savingsInterest: SavingsEntry[]
  benefitsInKind: BenefitEntry[]
}

// ─── Employment ──────────────────────────────────────────────────────────────

export interface EmploymentIncome {
  id: string
  employerName: string
  payslips: Payslip[]
}

export interface Payslip {
  id: string
  taxPeriod: number        // 1–12 (tax month, April = 1)
  taxYear: TaxYearKey
  date: string             // ISO date
  basicSalary: number
  carAllowance: number
  otherPayments: LineItem[]
  taxPaid: number
  employeeNI: number
  salarySacrifice: LineItem[]
  esppContribution: number
  employerMatch: number
  ytdGross: number
  ytdTaxPaid: number
  ytdEmployeeNI: number
  taxCode: string
  niNumber: string
  employerName: string
  rstVestIncome?: number   // one-off RSU vest income if detected
  rawExtracted: Record<string, string> // original AI output, for audit
}

export interface LineItem {
  label: string
  amount: number
}

// ─── Benefits ────────────────────────────────────────────────────────────────

export interface BenefitEntry {
  id: string
  type: 'car' | 'medical' | 'loan' | 'reimbursement' | 'other'
  description: string
  taxableValue: number
  taxYear: TaxYearKey
  sourceDocumentId?: string
}

// ─── Dividends / savings ─────────────────────────────────────────────────────

export interface DividendEntry {
  id: string
  description: string
  amount: number
  date: string
  taxYear: TaxYearKey
}

export interface SavingsEntry {
  id: string
  provider: string
  grossInterest: number
  taxYear: TaxYearKey
}

// ─── Share lots ───────────────────────────────────────────────────────────────

export type SchemeType =
  | 'espp-match'
  | 'espp-discounted'
  | 'rsu'
  | 'csop'
  | 'emi'
  | 'saye'

export interface ShareSchemeConfig {
  id: string
  employerName: string
  schemeType: SchemeType
  discountRate?: number     // for espp-discounted, e.g. 0.15
  currency: string          // e.g. "USD"
  exchange: string          // e.g. "NYSE"
  broker: string
  active: boolean
}

export interface ShareLot {
  id: string
  schemeId: string          // references ShareSchemeConfig.id
  employerName: string
  schemeType: SchemeType
  acquisitionDate: string   // ISO
  acquisitionPriceOriginal: number  // in scheme currency
  acquisitionPriceFX: number        // GBP/original-currency rate at acquisition
  acquisitionPriceGBP: number       // derived: original * fx
  quantity: number
  costBasisGBP: number      // market value at acquisition (RSU vest / ESPP purchase); NOT the discounted price paid
  incomeTaxPaidGBP?: number // income tax paid via PAYE on this lot (RSU vest, ESPP discount)
  taxableIncomeGBP?: number  // income realised at acquisition (ESPP discount / RSU vest value); taxed via PAYE, recorded for CGT basis + SA reference
  disposalDate?: string
  disposalPriceGBP?: number
  disposalProceedsGBP?: number
  gainLossGBP?: number
}

// ─── Life events ─────────────────────────────────────────────────────────────

export type LifeEventType =
  | 'salary-change'
  | 'salary-sacrifice-change'
  | 'benefit-enrolled'
  | 'benefit-removed'
  | 'rsu-vest'
  | 'new-scheme'
  | 'employment-change'

export interface LifeEvent {
  id: string
  date: string
  type: LifeEventType
  description: string
  data: Record<string, unknown> // typed per event type — see lib/lifeEvents.ts
}

// ─── Future income events ─────────────────────────────────────────────────────

export type FutureIncomeEventType = 'bonus' | 'pay-rise' | 'rsu-vest'

export interface FutureIncomeEvent {
  id: string
  type: FutureIncomeEventType
  label: string
  amount: number          // GBP; for 'pay-rise' this is the new ANNUAL salary
  effectiveDate: string   // ISO; must fall within the tax year to affect it
  taxYear: TaxYearKey
  subjectToNI?: boolean    // default true for bonus/pay-rise/rsu-vest
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface FeedbackEntry {
  id: string
  text: string
  screen: string          // route the user was on when they submitted
  profileId: ProfileId
  appEnv: string          // import.meta.env.MODE — distinguishes staging vs production
  createdAt: string       // ISO
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export type ProfileId = 'mike' | 'gemma'

export interface Profile {
  id: ProfileId
  firstName: string
  niNumber: string
  taxCode: string
  pinHash: string           // PBKDF2 hash
  pinSalt: string           // base64 encoded salt
  githubPat: string         // stored encrypted in repo; PAT is in localStorage only
  schemes: ShareSchemeConfig[]
  otherIncomeSources: ('dividends' | 'savings' | 'cgt' | 'rsu-vests' | 'benefits')[]
  baseAnnualSalary?: number   // GBP; user-stated current annual base salary
}

// ─── Glossary ─────────────────────────────────────────────────────────────────

export interface GlossaryEntry {
  term: string
  explanation: string  // plain English, 2–3 sentences
}
