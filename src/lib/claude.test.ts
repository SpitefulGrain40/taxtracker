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
