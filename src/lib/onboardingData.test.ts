import { describe, it, expect } from 'vitest'
import { buildOnboardingData, type OnboardingInput } from './onboardingData'
import type { Payslip } from '../types'

const payslip: Payslip = {
  id: 'p1', taxPeriod: 4, taxYear: '2025-26', date: '2025-07-31',
  basicSalary: 5000, carAllowance: 0, otherPayments: [], taxPaid: 900, employeeNI: 400,
  salarySacrifice: [], esppContribution: 0, employerMatch: 0,
  ytdGross: 20000, ytdTaxPaid: 3600, ytdEmployeeNI: 1600,
  taxCode: '1257L', niNumber: 'AB123456C', employerName: 'SAP UK Ltd', rawExtracted: {},
}

const base: OnboardingInput = {
  profileId: 'mike', firstName: 'Mike', niNumber: 'AB123456C', taxCode: '1257L',
  pinHash: 'h', pinSalt: 's', schemes: [], otherIncomeSources: [],
  key: '2025-26', payslip: null, baseAnnualSalary: null, bonus: null,
}

describe('buildOnboardingData', () => {
  it('persists the payslip into the tax year when present', () => {
    const { taxYear } = buildOnboardingData({ ...base, payslip })
    expect(taxYear.employment[0].payslips[0].ytdGross).toBe(20000)
  })

  it('produces an empty tax year when the payslip is skipped', () => {
    const { taxYear } = buildOnboardingData(base)
    expect(taxYear.employment).toEqual([])
  })

  it('includes baseAnnualSalary on the profile only when provided', () => {
    expect(buildOnboardingData(base).profile.baseAnnualSalary).toBeUndefined()
    expect(buildOnboardingData({ ...base, baseAnnualSalary: 60000 }).profile.baseAnnualSalary).toBe(60000)
  })

  it('creates a bonus future-event when a bonus is provided', () => {
    const { futureEvents } = buildOnboardingData({ ...base, bonus: { amount: 8000, effectiveDate: '2025-12-31' } })
    expect(futureEvents).toHaveLength(1)
    expect(futureEvents[0]).toMatchObject({ type: 'bonus', amount: 8000, taxYear: '2025-26', subjectToNI: true })
  })

  it('creates no future-events when no bonus is provided', () => {
    expect(buildOnboardingData(base).futureEvents).toEqual([])
  })

  it('always leaves githubPat empty on the saved profile', () => {
    expect(buildOnboardingData(base).profile.githubPat).toBe('')
  })
})
