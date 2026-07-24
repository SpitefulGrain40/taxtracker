import { describe, it, expect } from 'vitest'
import { buildManualLot, type ManualLotInput } from './lotBuilder'

const base: ManualLotInput = {
  schemeId: 's1', employerName: 'Acme Inc', schemeType: 'espp-discounted',
  acquisitionDate: '2025-09-04', quantity: 100, marketPricePerShare: 200,
  discountRate: 0.15, fxToGBP: 0.79,
}

describe('buildManualLot', () => {
  it('sets the CGT cost basis to the full GBP market value, not the discounted price paid', () => {
    const { lot } = buildManualLot(base)
    // 100 * 200 * 0.79 = 15800
    expect(lot.costBasisGBP).toBeCloseTo(15800, 2)
  })

  it('records the discount as taxable income (market x rate x fx x qty)', () => {
    const { lot, taxableIncomeGBP } = buildManualLot(base)
    // 200 * 0.15 * 0.79 * 100 = 2370
    expect(taxableIncomeGBP).toBeCloseTo(2370, 2)
    expect(lot.taxableIncomeGBP).toBeCloseTo(2370, 2)
  })

  it('reports the price actually paid (market value minus the discount)', () => {
    const { pricePaidGBP } = buildManualLot(base)
    expect(pricePaidGBP).toBeCloseTo(15800 - 2370, 2)
  })

  it('converts the per-share price to GBP via the acquisition-date FX rate', () => {
    const { lot } = buildManualLot(base)
    expect(lot.acquisitionPriceGBP).toBeCloseTo(200 * 0.79, 4)
    expect(lot.acquisitionPriceOriginal).toBe(200)
    expect(lot.acquisitionPriceFX).toBe(0.79)
  })

  it('treats an RSU vest as fully taxable at market value', () => {
    const { lot, taxableIncomeGBP } = buildManualLot({ ...base, schemeType: 'rsu', discountRate: undefined })
    expect(lot.costBasisGBP).toBeCloseTo(15800, 2)
    expect(taxableIncomeGBP).toBeCloseTo(15800, 2)
  })

  it('records no discount income for an employer-match ESPP', () => {
    const { lot, taxableIncomeGBP } = buildManualLot({ ...base, schemeType: 'espp-match', discountRate: undefined })
    expect(lot.costBasisGBP).toBeCloseTo(15800, 2)
    expect(taxableIncomeGBP).toBe(0)
    expect('taxableIncomeGBP' in lot).toBe(false)
  })

  it('treats a missing discount rate on a discounted ESPP as 0% (no discount income), keeping full market value as the cost basis', () => {
    const { lot, taxableIncomeGBP } = buildManualLot({ ...base, discountRate: undefined })
    expect(taxableIncomeGBP).toBe(0)
    expect('taxableIncomeGBP' in lot).toBe(false)
    expect(lot.costBasisGBP).toBeCloseTo(15800, 2)
  })

  it('is a no-op FX (rate 1) for a GBP scheme', () => {
    const { lot } = buildManualLot({ ...base, fxToGBP: 1 })
    expect(lot.costBasisGBP).toBeCloseTo(20000, 2)
    expect(lot.acquisitionPriceGBP).toBe(200)
  })

  it('carries the scheme metadata onto the lot', () => {
    const { lot } = buildManualLot(base)
    expect(lot.schemeId).toBe('s1')
    expect(lot.schemeType).toBe('espp-discounted')
    expect(lot.employerName).toBe('Acme Inc')
    expect(lot.acquisitionDate).toBe('2025-09-04')
    expect(lot.quantity).toBe(100)
    expect(typeof lot.id).toBe('string')
    expect(lot.disposalDate).toBeUndefined()
  })
})
