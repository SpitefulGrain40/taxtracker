import { describe, it, expect } from 'vitest'
import { applyPayslipEdits, findLatestPayslip } from './payslipEdit'
import type { TaxYear, Payslip } from '../types'

function makePayslip(overrides: Partial<Payslip>): Payslip {
  return {
    id: 'p1',
    taxPeriod: 3,
    taxYear: '2025-26',
    date: '2025-06-25',
    basicSalary: 5000,
    carAllowance: 0,
    otherPayments: [],
    taxPaid: 800,
    employeeNI: 300,
    salarySacrifice: [{ label: 'Pension', amount: 250 }],
    esppContribution: 150,
    employerMatch: 150,
    ytdGross: 15000,
    ytdTaxPaid: 2400,
    ytdEmployeeNI: 900,
    taxCode: '1257L',
    niNumber: 'AB123456C',
    employerName: 'SAP UK Ltd',
    rawExtracted: { grossPay: '5000.00', taxPeriod: '3' },
    ...overrides,
  }
}

const taxYear: TaxYear = {
  key: '2025-26',
  startDate: '2025-04-06',
  endDate: '2026-04-05',
  employment: [
    {
      id: 'emp1',
      employerName: 'SAP UK Ltd',
      payslips: [
        makePayslip({ id: 'p1', taxPeriod: 3 }),
        makePayslip({ id: 'p2', taxPeriod: 4, ytdGross: 20000 }),
      ],
    },
    {
      id: 'emp2',
      employerName: 'Side Gig Ltd',
      payslips: [makePayslip({ id: 'p3', taxPeriod: 1, ytdGross: 1000, employerName: 'Side Gig Ltd' })],
    },
  ],
  dividends: [],
  savingsInterest: [],
  benefitsInKind: [],
}

const edits = {
  ytdGross: 21000,
  ytdTaxPaid: 3400,
  ytdEmployeeNI: 1200,
  basicSalary: 5500,
  taxPaid: 900,
  employeeNI: 320,
  taxCode: 'K289',
  taxPeriod: 4,
}

describe('findLatestPayslip', () => {
  it('picks the payslip with the highest taxPeriod across employments', () => {
    const latest = findLatestPayslip(taxYear)
    expect(latest?.payslip.id).toBe('p2')
    expect(latest?.employmentId).toBe('emp1')
  })

  it('returns null when there are no payslips', () => {
    const empty: TaxYear = { ...taxYear, employment: [{ id: 'emp1', employerName: 'SAP UK Ltd', payslips: [] }] }
    expect(findLatestPayslip(empty)).toBeNull()
  })
})

describe('applyPayslipEdits', () => {
  it('updates the target payslip with the edited fields', () => {
    const updated = applyPayslipEdits(taxYear, 'emp1', 'p2', edits)
    const target = updated.employment.find(e => e.id === 'emp1')!.payslips.find(p => p.id === 'p2')!
    expect(target.ytdGross).toBe(21000)
    expect(target.ytdTaxPaid).toBe(3400)
    expect(target.ytdEmployeeNI).toBe(1200)
    expect(target.basicSalary).toBe(5500)
    expect(target.taxPaid).toBe(900)
    expect(target.employeeNI).toBe(320)
    expect(target.taxCode).toBe('K289')
    expect(target.taxPeriod).toBe(4)
  })

  it('leaves other payslips and employments untouched', () => {
    const updated = applyPayslipEdits(taxYear, 'emp1', 'p2', edits)
    const untouchedInSameEmployment = updated.employment.find(e => e.id === 'emp1')!.payslips.find(p => p.id === 'p1')!
    expect(untouchedInSameEmployment).toEqual(taxYear.employment[0].payslips[0])

    const otherEmployment = updated.employment.find(e => e.id === 'emp2')!
    expect(otherEmployment).toEqual(taxYear.employment[1])
  })

  it('preserves every field not present in edits, including rawExtracted', () => {
    const updated = applyPayslipEdits(taxYear, 'emp1', 'p2', edits)
    const target = updated.employment.find(e => e.id === 'emp1')!.payslips.find(p => p.id === 'p2')!
    const original = taxYear.employment[0].payslips[1]

    expect(target.rawExtracted).toEqual(original.rawExtracted)
    expect(target.salarySacrifice).toEqual(original.salarySacrifice)
    expect(target.otherPayments).toEqual(original.otherPayments)
    expect(target.esppContribution).toBe(original.esppContribution)
    expect(target.employerMatch).toBe(original.employerMatch)
    expect(target.id).toBe(original.id)
    expect(target.date).toBe(original.date)
    expect(target.employerName).toBe(original.employerName)
    expect(target.niNumber).toBe(original.niNumber)
    expect(target.carAllowance).toBe(original.carAllowance)
  })

  it('does not mutate the original taxYear object or its nested arrays', () => {
    const snapshot = JSON.parse(JSON.stringify(taxYear))
    applyPayslipEdits(taxYear, 'emp1', 'p2', edits)
    expect(taxYear).toEqual(snapshot)
  })
})
