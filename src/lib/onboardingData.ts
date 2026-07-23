import type { Payslip, Profile, ProfileId, TaxYear, TaxYearKey, ShareSchemeConfig, FutureIncomeEvent } from '../types'
import { emptyTaxYear, taxYearWithPayslip } from './dataRepo'

export interface OnboardingInput {
  profileId: ProfileId
  firstName: string
  niNumber: string
  taxCode: string
  pinHash: string
  pinSalt: string
  schemes: ShareSchemeConfig[]
  otherIncomeSources: Profile['otherIncomeSources']
  key: TaxYearKey
  payslip: Payslip | null
  baseAnnualSalary: number | null
  bonus: { amount: number; effectiveDate: string } | null
}

export interface OnboardingData {
  profile: Profile
  taxYear: TaxYear
  futureEvents: FutureIncomeEvent[]
}

export function buildOnboardingData(input: OnboardingInput): OnboardingData {
  const profile: Profile = {
    id: input.profileId,
    firstName: input.firstName,
    niNumber: input.niNumber,
    taxCode: input.taxCode,
    pinHash: input.pinHash,
    pinSalt: input.pinSalt,
    githubPat: '',
    schemes: input.schemes,
    otherIncomeSources: input.otherIncomeSources,
    ...(input.baseAnnualSalary != null ? { baseAnnualSalary: input.baseAnnualSalary } : {}),
  }

  const taxYear = input.payslip
    ? taxYearWithPayslip(input.key, input.payslip)
    : emptyTaxYear(input.key)

  const futureEvents: FutureIncomeEvent[] = input.bonus
    ? [{
        id: `bonus-${input.key}`,
        type: 'bonus',
        label: 'Expected bonus',
        amount: input.bonus.amount,
        effectiveDate: input.bonus.effectiveDate,
        taxYear: input.key,
        subjectToNI: true,
      }]
    : []

  return { profile, taxYear, futureEvents }
}
