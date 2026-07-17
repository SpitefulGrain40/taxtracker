import { describe, it, expect } from 'vitest'
import { section104Pool, disposalGain, cgtOnDisposal } from './cgt'
import { RATES_2025_26 as R } from './taxRates'
import type { ShareLot } from '../types'

function lot(id: string, qty: number, costGBP: number): ShareLot {
  return {
    id, schemeId: 's1', employerName: 'SAP UK Limited', schemeType: 'espp-match',
    acquisitionDate: '2025-09-04', acquisitionPriceOriginal: costGBP, acquisitionPriceFX: 1,
    acquisitionPriceGBP: costGBP, quantity: qty, costBasisGBP: costGBP * qty,
  }
}

describe('section104Pool', () => {
  it('pools quantity and cost across lots', () => {
    const pool = section104Pool([lot('a', 10, 100), lot('b', 5, 120)])
    // 10 @ £100 (£1000) + 5 @ £120 (£600) = 15 shares, £1600 total cost
    expect(pool.quantity).toBe(15)
    expect(pool.totalCost).toBeCloseTo(1600, 2)
    expect(pool.averageCost).toBeCloseTo(1600 / 15, 4)
  })
  it('ignores already-disposed lots', () => {
    const disposed = { ...lot('c', 8, 100), disposalDate: '2026-01-01' }
    const pool = section104Pool([lot('a', 10, 100), disposed])
    expect(pool.quantity).toBe(10)
  })
  it('handles empty', () => {
    expect(section104Pool([]).quantity).toBe(0)
    expect(section104Pool([]).averageCost).toBe(0)
  })
})

describe('disposalGain', () => {
  it('computes gain from average cost', () => {
    // pool avg £106.67/share; sell 6 @ £150 = £900 proceeds, cost 6*106.67=£640, gain £260
    const pool = section104Pool([lot('a', 10, 100), lot('b', 5, 120)])
    const g = disposalGain(pool, 6, 150)
    expect(g.proceeds).toBeCloseTo(900, 2)
    expect(g.costOfSold).toBeCloseTo(6 * (1600 / 15), 2)
    expect(g.gain).toBeCloseTo(900 - 6 * (1600 / 15), 2)
  })
  it('gain is zero if selling at average cost', () => {
    const pool = section104Pool([lot('a', 10, 100)])
    const g = disposalGain(pool, 5, 100)
    expect(g.gain).toBeCloseTo(0, 2)
  })
})

describe('cgtOnDisposal', () => {
  it('applies annual exempt amount then CGT rate', () => {
    // gain £5,000, £3,000 exempt → £2,000 taxable. Higher-rate taxpayer 24% = £480
    const r = cgtOnDisposal(5000, 'higher', 0, R)
    expect(r.taxableGain).toBe(2000)
    expect(r.tax).toBeCloseTo(480, 2)
  })
  it('uses basic rate 18% for basic-rate taxpayer', () => {
    const r = cgtOnDisposal(5000, 'basic', 0, R)
    expect(r.tax).toBeCloseTo(2000 * 0.18, 2)
  })
  it('reduces remaining exemption by exemptionUsed', () => {
    // £3,000 already used → full £5,000 gain taxable
    const r = cgtOnDisposal(5000, 'higher', 3000, R)
    expect(r.taxableGain).toBe(5000)
  })
  it('no tax when gain within remaining exemption', () => {
    const r = cgtOnDisposal(2000, 'higher', 0, R)
    expect(r.taxableGain).toBe(0)
    expect(r.tax).toBe(0)
  })
})
