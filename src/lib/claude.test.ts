import { describe, it, expect } from 'vitest'
import { parsePayslipResponse } from './claude'

describe('parsePayslipResponse', () => {
  it('parses a complete extraction response', () => {
    const raw = JSON.stringify({
      basicSalary: 8879.00,
      carAllowance: 700.00,
      taxPaid: 2819.27,
      employeeNI: 343.34,
      esppContribution: 266.37,
      employerMatch: 124.35,
      salarySacrifice: [{ label: 'Crit. Illness', amount: -23.27 }, { label: 'EE Sal Sac', amount: -887.90 }],
      otherPayments: [],
      ytdGross: 26377.03,
      ytdTaxPaid: 8457.80,
      ytdEmployeeNI: 1030.03,
      taxCode: '207T',
      niNumber: 'JL041798C',
      employerName: 'SAP UK Limited',
      payDate: '2025-06-30',
      rstVestIncome: null,
    })
    const result = parsePayslipResponse(raw)
    expect(result.basicSalary).toBe(8879.00)
    expect(result.taxCode).toBe('207T')
    expect(result.niNumber).toBe('JL041798C')
    expect(result.employerName).toBe('SAP UK Limited')
    expect(result.salarySacrifice).toHaveLength(2)
    expect(result.rstVestIncome).toBeUndefined()
  })

  it('handles missing optional fields gracefully', () => {
    const raw = JSON.stringify({
      basicSalary: 5000,
      carAllowance: 0,
      taxPaid: 800,
      employeeNI: 200,
      esppContribution: 0,
      employerMatch: 0,
      salarySacrifice: [],
      otherPayments: [],
      ytdGross: 5000,
      ytdTaxPaid: 800,
      ytdEmployeeNI: 200,
      taxCode: '1257L',
      niNumber: '',
      employerName: 'Test Corp',
      payDate: '2025-04-30',
    })
    const result = parsePayslipResponse(raw)
    expect(result.basicSalary).toBe(5000)
    expect(result.carAllowance).toBe(0)
    expect(result.esppContribution).toBe(0)
    expect(result.employerMatch).toBe(0)
    expect(result.salarySacrifice).toEqual([])
    expect(result.otherPayments).toEqual([])
    expect(result.rstVestIncome).toBeUndefined()
  })

  it('throws on invalid JSON', () => {
    expect(() => parsePayslipResponse('not json')).toThrow()
  })
})

import { parseP11DResponse, parseP60Response } from './claude'

describe('parseP11DResponse', () => {
  it('parses benefit line items', () => {
    const raw = JSON.stringify({
      taxYear: '2024-25',
      benefits: [
        { type: 'medical', description: 'Private medical insurance', taxableValue: 1450.00 },
        { type: 'car', description: 'Company car', taxableValue: 3200.00 },
      ],
    })
    const r = parseP11DResponse(raw)
    expect(r.taxYear).toBe('2024-25')
    expect(r.benefits).toHaveLength(2)
    expect(r.benefits[0].taxableValue).toBe(1450.00)
    expect(r.benefits[1].type).toBe('car')
  })
  it('handles empty benefits array', () => {
    const r = parseP11DResponse(JSON.stringify({ taxYear: '2024-25', benefits: [] }))
    expect(r.benefits).toEqual([])
  })
  it('throws on invalid JSON', () => {
    expect(() => parseP11DResponse('nope')).toThrow()
  })
})

describe('parseP60Response', () => {
  it('parses year-end totals', () => {
    const raw = JSON.stringify({
      taxYear: '2024-25',
      totalPay: 98000.00,
      totalTaxDeducted: 27500.00,
      totalEmployeeNI: 4100.00,
      employerName: 'SAP UK Limited',
      taxCode: 'K289',
    })
    const r = parseP60Response(raw)
    expect(r.totalPay).toBe(98000.00)
    expect(r.totalTaxDeducted).toBe(27500.00)
    expect(r.taxCode).toBe('K289')
  })
  it('throws when required numeric field missing', () => {
    expect(() => parseP60Response(JSON.stringify({ taxYear: '2024-25', employerName: 'X' }))).toThrow()
  })
})
