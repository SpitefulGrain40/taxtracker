import { describe, it, expect } from 'vitest'
import {
  effectivePersonalAllowance,
  parseTaxCode,
  incomeTax,
  employeeNI,
  dividendTax,
  savingsTax,
  marginalBand,
} from './taxCalc'
import { RATES_2025_26 as R } from './taxRates'

describe('effectivePersonalAllowance', () => {
  it('is full PA below taper threshold', () => {
    expect(effectivePersonalAllowance(50000, R)).toBe(12570)
  })
  it('tapers £1 per £2 above £100k', () => {
    expect(effectivePersonalAllowance(110000, R)).toBe(12570 - 5000)
  })
  it('is zero at £125,140+', () => {
    expect(effectivePersonalAllowance(125140, R)).toBe(0)
    expect(effectivePersonalAllowance(200000, R)).toBe(0)
  })
})

describe('parseTaxCode', () => {
  it('parses standard L code to an allowance', () => {
    expect(parseTaxCode('1257L')).toEqual({ allowance: 12570, kCode: false })
  })
  it('parses K code as negative allowance (added to income)', () => {
    expect(parseTaxCode('K289')).toEqual({ allowance: -2890, kCode: true })
  })
  it('handles BR / D0 / NT as null allowance', () => {
    expect(parseTaxCode('BR').allowance).toBeNull()
  })
})

describe('incomeTax', () => {
  it('is zero below personal allowance', () => {
    expect(incomeTax(10000, 12570, R)).toBe(0)
  })
  it('taxes basic rate correctly', () => {
    expect(incomeTax(30000, 12570, R)).toBeCloseTo(3486, 0)
  })
  it('taxes into higher rate', () => {
    expect(incomeTax(60000, 12570, R)).toBeCloseTo(11432, 0)
  })
  it('handles K-code (negative allowance adds to taxable income)', () => {
    expect(incomeTax(60000, -2890, R)).toBeCloseTo(17616, 0)
  })
})

describe('employeeNI', () => {
  it('is zero below primary threshold', () => {
    expect(employeeNI(12000, R)).toBe(0)
  })
  it('charges 8% between PT and UEL', () => {
    expect(employeeNI(30000, R)).toBeCloseTo(1394.4, 1)
  })
  it('charges 2% above UEL', () => {
    expect(employeeNI(60000, R)).toBeCloseTo(3210.6, 1)
  })
})

describe('dividendTax', () => {
  it('is zero within allowance', () => {
    expect(dividendTax(400, 'basic', R)).toBe(0)
  })
  it('taxes excess at basic dividend rate', () => {
    expect(dividendTax(2000, 'basic', R)).toBeCloseTo(131.25, 2)
  })
  it('taxes at higher rate for higher-rate taxpayer', () => {
    expect(dividendTax(2000, 'higher', R)).toBeCloseTo(1500 * 0.3375, 2)
  })
})

describe('savingsTax', () => {
  it('is zero within PSA for basic rate', () => {
    expect(savingsTax(900, 'basic', R)).toBe(0)
  })
  it('taxes excess at the taxpayer marginal rate', () => {
    expect(savingsTax(2000, 'basic', R)).toBeCloseTo(200, 2)
  })
})

describe('marginalBand', () => {
  it('classifies basic-rate taxpayer', () => {
    expect(marginalBand(30000, R)).toBe('basic')
  })
  it('classifies higher-rate taxpayer', () => {
    expect(marginalBand(60000, R)).toBe('higher')
  })
  it('classifies additional-rate taxpayer', () => {
    expect(marginalBand(200000, R)).toBe('additional')
  })
})
