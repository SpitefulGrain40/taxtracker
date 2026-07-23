import { describe, it, expect } from 'vitest'
import { percentToFraction, fractionToPercent } from './schemeEdit'

describe('percentToFraction', () => {
  it('converts a whole-number percentage to a fraction', () => {
    expect(percentToFraction('15')).toBe(0.15)
  })

  it('treats 0 as a real value, not absent', () => {
    expect(percentToFraction('0')).toBe(0)
  })

  it('treats an empty string as absent', () => {
    expect(percentToFraction('')).toBeNull()
  })

  it('rejects non-numeric text', () => {
    expect(percentToFraction('abc')).toBeNull()
  })

  it('has no floating-point drift for a clean percentage', () => {
    // Guards against 15/100 producing 0.15000000000000002 instead of 0.15 —
    // a drifted discountRate would misstate the taxable ESPP discount.
    expect(percentToFraction('15')).toBe(0.15)
    expect(Object.is(percentToFraction('15'), 0.15)).toBe(true)
  })
})

describe('fractionToPercent', () => {
  it('returns an empty string when the fraction is absent', () => {
    expect(fractionToPercent(undefined)).toBe('')
  })

  it('round-trips a stored fraction back to its percentage', () => {
    expect(fractionToPercent(0.15)).toBe('15')
  })
})

describe('percentToFraction / fractionToPercent round trip', () => {
  it('recovers the original percentage string', () => {
    const fraction = percentToFraction('15')
    expect(fraction).not.toBeNull()
    expect(fractionToPercent(fraction as number)).toBe('15')
  })
})
