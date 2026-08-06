import { describe, it, expect } from 'vitest'
import { projectTaxYear, type ProjectionInput } from './projection'
import { CURRENT_RATES } from './taxRates'
import type { TaxYear, Payslip, FutureIncomeEvent } from '../types'

function payslip(over: Partial<Payslip> = {}): Payslip {
  return {
    id: 'p1', taxPeriod: 6, taxYear: '2025-26', date: '2025-09-30',
    basicSalary: 5000, carAllowance: 0, otherPayments: [], taxPaid: 800, employeeNI: 300,
    salarySacrifice: [], esppContribution: 0, employerMatch: 0,
    ytdGross: 30000, ytdTaxPaid: 4800, ytdEmployeeNI: 1800,
    taxCode: '1257L', niNumber: 'AB123456C', employerName: 'SAP UK Ltd', rawExtracted: {},
    ...over,
  }
}

function taxYear(payslips: Payslip[], over: Partial<TaxYear> = {}): TaxYear {
  return {
    key: '2025-26', startDate: '2025-04-06', endDate: '2026-04-05',
    employment: payslips.length ? [{ id: 'e1', employerName: 'SAP UK Ltd', payslips }] : [],
    dividends: [], savingsInterest: [], benefitsInKind: [], ...over,
  }
}

const baseInput = (over: Partial<ProjectionInput> = {}): ProjectionInput => ({
  taxYear: taxYear([payslip()]), events: [], baseAnnualSalary: null, taxCode: '1257L',
  rates: CURRENT_RATES, ...over,
})

describe('projectTaxYear', () => {
  it('is unavailable when there is no payslip', () => {
    const p = projectTaxYear(baseInput({ taxYear: taxYear([]) }))
    expect(p.available).toBe(false)
    expect(p.projectedGross).toBe(0)
  })

  it('annualises the YTD run-rate when no base salary is stated', () => {
    // ytdGross 30000 at period 6 → monthly 5000 → 12 months = 60000
    const p = projectTaxYear(baseInput())
    expect(p.available).toBe(true)
    expect(p.usedStatedSalary).toBe(false)
    expect(p.projectedGross).toBeCloseTo(60000, 2)
  })

  it('prefers a stated base salary over the run-rate for future months', () => {
    // ytdGross 30000 (periods 1-6), stated 72000 → future 6 months at 6000 = 36000 → 66000
    const p = projectTaxYear(baseInput({ baseAnnualSalary: 72000 }))
    expect(p.usedStatedSalary).toBe(true)
    expect(p.projectedGross).toBeCloseTo(66000, 2)
  })

  it('adds a one-off bonus to the projected gross', () => {
    const bonus: FutureIncomeEvent = { id: 'b', type: 'bonus', label: 'Bonus', amount: 8000, effectiveDate: '2026-03-31', taxYear: '2025-26', subjectToNI: true }
    const withB = projectTaxYear(baseInput({ events: [bonus] }))
    const without = projectTaxYear(baseInput())
    expect(withB.projectedGross - without.projectedGross).toBeCloseTo(8000, 2)
  })

  it('steps the run-rate up from a pay-rise effective date', () => {
    // pay-rise to 96000/yr (8000/mo) effective period 9 (Dec) → periods 9-12 at 8000
    const raise: FutureIncomeEvent = { id: 'r', type: 'pay-rise', label: 'Raise', amount: 96000, effectiveDate: '2025-12-01', taxYear: '2025-26', subjectToNI: true }
    const withR = projectTaxYear(baseInput({ events: [raise] }))
    const without = projectTaxYear(baseInput())
    expect(withR.projectedGross).toBeGreaterThan(without.projectedGross)
  })

  it('ignores events from a different tax year', () => {
    const other: FutureIncomeEvent = { id: 'o', type: 'bonus', label: 'Old', amount: 5000, effectiveDate: '2024-12-31', taxYear: '2024-25', subjectToNI: true }
    expect(projectTaxYear(baseInput({ events: [other] })).projectedGross).toBeCloseTo(60000, 2)
  })

  it('adds untaxed dividend income to the shortfall to set aside', () => {
    const withDiv = projectTaxYear(baseInput({ taxYear: taxYear([payslip()], { dividends: [{ id: 'd', description: 'Acme', amount: 6000, date: '2025-08-01', taxYear: '2025-26' }] }) }))
    const without = projectTaxYear(baseInput())
    // dividends are not withheld by PAYE, so they raise the year-end set-aside
    expect(withDiv.shortfall).toBeGreaterThan(without.shortfall)
  })

  it('produces a positive projected tax due for a normal earner', () => {
    const p = projectTaxYear(baseInput())
    expect(p.projectedTaxDue).toBeGreaterThan(0)
    expect(['basic', 'higher', 'additional']).toContain(p.band)
  })

  it('explains its run-rate assumption, and switches to stated-salary wording', () => {
    const runRate = projectTaxYear(baseInput())
    expect(runRate.assumptions.some(a => /typical month/i.test(a))).toBe(true)
    const stated = projectTaxYear(baseInput({ baseAnnualSalary: 72000 }))
    expect(stated.assumptions.some(a => /stated base salary/i.test(a))).toBe(true)
  })

  it('does not dump tax on the stated-vs-run-rate salary gap into the shortfall (PAYE withholds it)', () => {
    const runRate = projectTaxYear(baseInput())
    const statedHigher = projectTaxYear(baseInput({ baseAnnualSalary: 72000 }))
    expect(statedHigher.projectedGross).toBeGreaterThan(runRate.projectedGross)
    // the extra future salary is PAYE-withheld, so the year-end set-aside barely moves
    expect(statedHigher.shortfall).toBeCloseTo(runRate.shortfall, 0)
  })

  describe('breakdown', () => {
    it('base-only: a single base item close to projectedGross', () => {
      const p = projectTaxYear(baseInput())
      expect(p.breakdown.items).toHaveLength(1)
      expect(p.breakdown.items[0].type).toBe('base')
      expect(p.breakdown.items[0].amount).toBeCloseTo(p.projectedGross, 2)
      expect(p.breakdown.baseAnnualised).toBeCloseTo(p.projectedGross, 2)
    })

    it('with a bonus: includes a bonus line equal to the bonus amount, and the sum invariant holds', () => {
      const bonus: FutureIncomeEvent = { id: 'b', type: 'bonus', label: 'Bonus', amount: 8000, effectiveDate: '2026-03-31', taxYear: '2025-26', subjectToNI: true }
      const p = projectTaxYear(baseInput({ events: [bonus] }))
      const bonusItem = p.breakdown.items.find(i => i.type === 'bonus')
      expect(bonusItem).toBeDefined()
      expect(bonusItem?.amount).toBeCloseTo(8000, 2)
      const nonBaseSum = p.breakdown.items.filter(i => i.type !== 'base').reduce((s, i) => s + i.amount, 0)
      expect(p.breakdown.baseAnnualised + nonBaseSum).toBeCloseTo(p.projectedGross, 2)
    })

    it('with a pay rise: includes a positive pay-rise item and the sum invariant holds', () => {
      const raise: FutureIncomeEvent = { id: 'r', type: 'pay-rise', label: 'Raise', amount: 96000, effectiveDate: '2025-12-01', taxYear: '2025-26', subjectToNI: true }
      const p = projectTaxYear(baseInput({ events: [raise] }))
      const raiseItem = p.breakdown.items.find(i => i.type === 'pay-rise')
      expect(raiseItem).toBeDefined()
      expect(raiseItem!.amount).toBeGreaterThan(0)
      const nonBaseSum = p.breakdown.items.filter(i => i.type !== 'base').reduce((s, i) => s + i.amount, 0)
      expect(p.breakdown.baseAnnualised + nonBaseSum).toBeCloseTo(p.projectedGross, 2)
    })

    it('itemises the pay-rise delta as the amount above the flat run-rate', () => {
      const raise: FutureIncomeEvent = { id: 'r', type: 'pay-rise', label: 'Raise', amount: 96000, effectiveDate: '2025-12-01', taxYear: '2025-26', subjectToNI: true }
      const p = projectTaxYear(baseInput({ events: [raise] }))
      const item = p.breakdown.items.find(i => i.type === 'pay-rise')
      // periods 9-12 move from 5000/mo (30000 ytd / 6) to 8000/mo (96000 / 12)
      expect(item?.amount).toBeCloseTo(12000, 2)
    })

    it('keeps the breakdown adding up when a bonus and a pay rise are combined', () => {
      const raise: FutureIncomeEvent = { id: 'r', type: 'pay-rise', label: 'Raise', amount: 96000, effectiveDate: '2025-12-01', taxYear: '2025-26', subjectToNI: true }
      const bonus: FutureIncomeEvent = { id: 'b', type: 'bonus', label: 'Bonus', amount: 8000, effectiveDate: '2026-03-31', taxYear: '2025-26', subjectToNI: true }
      const p = projectTaxYear(baseInput({ events: [raise, bonus] }))
      const nonBase = p.breakdown.items.filter(i => i.type !== 'base').reduce((s, i) => s + i.amount, 0)
      expect(p.breakdown.baseAnnualised + nonBase).toBeCloseTo(p.projectedGross, 2)
      expect(p.breakdown.items.some(i => i.type === 'bonus')).toBe(true)
      expect(p.breakdown.items.some(i => i.type === 'pay-rise')).toBe(true)
    })

    it('is empty and zeroed when unavailable', () => {
      const p = projectTaxYear(baseInput({ taxYear: taxYear([]) }))
      expect(p.breakdown.items).toEqual([])
      expect(p.breakdown.baseAnnualised).toBe(0)
    })
  })
})
