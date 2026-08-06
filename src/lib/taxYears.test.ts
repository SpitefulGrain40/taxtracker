import { describe, it, expect } from 'vitest'
import { getTaxYearKey, getTaxYearLabel, monthsIntoTaxYear, getCurrentTaxYear, recentTaxYears } from './taxYears'

describe('getTaxYearKey', () => {
  it('returns 2025-26 for a date in April 2025', () => {
    expect(getTaxYearKey(new Date('2025-06-15'))).toBe('2025-26')
  })

  it('returns 2024-25 for a date in January 2025', () => {
    expect(getTaxYearKey(new Date('2025-01-01'))).toBe('2024-25')
  })

  it('returns 2025-26 for exactly 6 April 2025', () => {
    expect(getTaxYearKey(new Date('2025-04-06'))).toBe('2025-26')
  })
})

describe('getTaxYearLabel', () => {
  it('returns readable label', () => {
    expect(getTaxYearLabel('2025-26')).toBe('2025–26')
  })
})

describe('monthsIntoTaxYear', () => {
  it('returns 4 for July (month 4 of tax year, April = 1)', () => {
    expect(monthsIntoTaxYear(new Date('2025-07-01'))).toBe(4)
  })

  it('returns 1 for April', () => {
    expect(monthsIntoTaxYear(new Date('2025-04-15'))).toBe(1)
  })
})

describe('recentTaxYears', () => {
  it('returns count years starting with the current tax year, newest first', () => {
    const current = getCurrentTaxYear()
    const [startStr] = current.split('-')
    const start = parseInt(startStr, 10)
    const expected = Array.from({ length: 4 }, (_, i) => {
      const y = start - i
      return `${y}-${String(y + 1).slice(-2)}`
    })

    const result = recentTaxYears(4)

    expect(result).toHaveLength(4)
    expect(result[0]).toBe(current)
    expect(result[1]).toBe(expected[1])
    expect(result).toEqual(expected)
  })
})
