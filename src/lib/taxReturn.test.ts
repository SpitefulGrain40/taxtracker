import { describe, it, expect } from 'vitest'
import { buildTaxReturn, totalTaxableIncome } from './taxReturn'
import { emptyTaxYear } from './dataRepo'
import { RATES_2025_26 as R } from './taxRates'
import type { TaxYear, ShareLot } from '../types'

function fullYear(): TaxYear {
  const ty = emptyTaxYear('2025-26')
  ty.employment = [{
    id: 'e1', employerName: 'SAP UK Limited',
    payslips: [{
      id: 'p1', taxPeriod: 12, taxYear: '2025-26', date: '2026-04-05',
      basicSalary: 0, carAllowance: 0, otherPayments: [], taxPaid: 0, employeeNI: 0,
      salarySacrifice: [], esppContribution: 0, employerMatch: 0,
      ytdGross: 105480, ytdTaxPaid: 28620, ytdEmployeeNI: 4100,
      taxCode: 'K289', niNumber: 'JL041798C', employerName: 'SAP UK Limited', rawExtracted: {},
    }],
  }]
  ty.dividends = [{ id: 'd1', description: 'SAP', amount: 800, date: '2026-01-01', taxYear: '2025-26' }]
  ty.savingsInterest = [{ id: 's1', provider: 'Bank', grossInterest: 1200, taxYear: '2025-26' }]
  ty.benefitsInKind = [{ id: 'b1', type: 'medical', description: 'Private medical', taxableValue: 1450, taxYear: '2025-26' }]
  return ty
}

describe('totalTaxableIncome', () => {
  it('sums employment + dividends + savings + benefits', () => {
    const total = totalTaxableIncome(fullYear())
    expect(total).toBeCloseTo(105480 + 800 + 1200 + 1450, 2)
  })
})

describe('buildTaxReturn', () => {
  it('produces SA102 employment section with pay + tax boxes', () => {
    const model = buildTaxReturn(fullYear(), [], R)
    const sa102 = model.sections.find(s => s.code === 'SA102')
    expect(sa102).toBeTruthy()
    const payBox = sa102!.boxes.find(b => b.box === '1')
    expect(payBox?.value).toBeCloseTo(105480, 2)
    const taxBox = sa102!.boxes.find(b => b.box === '2')
    expect(taxBox?.value).toBeCloseTo(28620, 2)
  })

  it('includes benefits in SA102', () => {
    const model = buildTaxReturn(fullYear(), [], R)
    const sa102 = model.sections.find(s => s.code === 'SA102')
    const benefitBox = sa102!.boxes.find(b => b.label.toLowerCase().includes('benefit'))
    expect(benefitBox?.value).toBeCloseTo(1450, 2)
  })

  it('produces dividends and savings sections', () => {
    const model = buildTaxReturn(fullYear(), [], R)
    expect(model.sections.find(s => s.code === 'DIV')?.boxes[0].value).toBe(800)
    expect(model.sections.find(s => s.code === 'SAV')?.boxes[0].value).toBe(1200)
  })

  it('CGT section reflects share pool gain when lots present', () => {
    const lots: ShareLot[] = [{
      id: 'l1', schemeId: 's1', employerName: 'SAP', schemeType: 'espp-match',
      acquisitionDate: '2025-09-04', acquisitionPriceOriginal: 100, acquisitionPriceFX: 1,
      acquisitionPriceGBP: 100, quantity: 10, costBasisGBP: 1000,
    }]
    const model = buildTaxReturn(fullYear(), lots, R)
    const cgt = model.sections.find(s => s.code === 'CGT')
    expect(cgt).toBeTruthy()
  })

  it('reports readiness — sections needing input are flagged incomplete', () => {
    const empty = emptyTaxYear('2025-26')
    const model = buildTaxReturn(empty, [], R)
    expect(model.readyCount).toBeLessThan(model.totalSections)
  })

  it('classifies band on TOTAL income not just employment', () => {
    // £48k employment + £5k dividends + £3k savings = £56k total → higher rate
    const ty = emptyTaxYear('2025-26')
    ty.employment = [{ id: 'e', employerName: 'X', payslips: [{
      id: 'p', taxPeriod: 12, taxYear: '2025-26', date: '2026-04-05',
      basicSalary: 0, carAllowance: 0, otherPayments: [], taxPaid: 0, employeeNI: 0,
      salarySacrifice: [], esppContribution: 0, employerMatch: 0,
      ytdGross: 48000, ytdTaxPaid: 7000, ytdEmployeeNI: 3000,
      taxCode: '1257L', niNumber: '', employerName: 'X', rawExtracted: {},
    }] }]
    ty.dividends = [{ id: 'd', description: 'x', amount: 5000, date: '2026-01-01', taxYear: '2025-26' }]
    ty.savingsInterest = [{ id: 's', provider: 'x', grossInterest: 3000, taxYear: '2025-26' }]
    const model = buildTaxReturn(ty, [], R)
    expect(model.band).toBe('higher')
  })
})
