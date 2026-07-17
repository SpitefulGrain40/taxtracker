import { describe, it, expect } from 'vitest'
import { excelToISO, rowsToLots } from './portfolioImport'

describe('excelToISO', () => {
  it('converts Excel serial to ISO date', () => {
    expect(excelToISO(45904)).toBe('2025-09-04')
    expect(excelToISO(46209)).toBe('2026-07-06')
  })
})

describe('rowsToLots', () => {
  // Simulates parsed rows from a SAP PortfolioDetails export (header + data)
  const rows = [
    ['Allocation date', 'Plan', 'Instrument type', 'Instrument', 'Participation description', 'Contribution type', 'Strike price / Cost basis', 'Market price', 'Available from', 'Expiry date', 'Allocated quantity', 'Outstanding quantity', 'Available quantity'],
    [45904, 'Own SAP', 'shares', 'Own SAP', 'OWN Purchase September 2025', 'Purchase', 233.30335, 137.64, 45904, '', 1.28948, 1.28948, 1.28948],
    [45904, 'Own SAP', 'shares', 'Own SAP', 'OWN Purchase September 2025', 'Company match', 233.30335, 137.64, 45904, '', 0.59909, 0.59909, 0.59909],
    [46091, 'Elevate & Move SAP', 'restricted stock units', 'Elevate SAP - RSU share-settled', 'Elevate Annual Share 2026Q1', 'Award', 137.64, 46456, 401768, '', 44.597, 44.597, 0],
  ]

  it('maps Purchase and Company match rows to espp-match lots', () => {
    const lots = rowsToLots(rows, 'scheme-1', 'SAP UK Limited')
    const espp = lots.filter(l => l.schemeType === 'espp-match')
    expect(espp).toHaveLength(2)
    expect(espp[0].quantity).toBeCloseTo(1.28948, 5)
    expect(espp[0].acquisitionDate).toBe('2025-09-04')
    expect(espp[0].acquisitionPriceGBP).toBeCloseTo(233.30335, 4)
    expect(espp[0].costBasisGBP).toBeCloseTo(233.30335 * 1.28948, 2)
  })

  it('maps RSU award rows to rsu lots', () => {
    const lots = rowsToLots(rows, 'scheme-1', 'SAP UK Limited')
    const rsu = lots.filter(l => l.schemeType === 'rsu')
    expect(rsu).toHaveLength(1)
    expect(rsu[0].quantity).toBeCloseTo(44.597, 3)
    expect(rsu[0].costBasisGBP).toBeCloseTo(137.64 * 44.597, 2)
  })

  it('skips zero-quantity and malformed rows', () => {
    const withBlank = [...rows, [null, '', '', '', '', '', '', '', '', '', 0, 0, 0]]
    const lots = rowsToLots(withBlank, 'scheme-1', 'SAP UK Limited')
    expect(lots).toHaveLength(3)  // blank row ignored
  })
})
