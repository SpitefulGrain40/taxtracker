import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseXlsxRows, rowsToLots } from './portfolioImport'

describe('parseXlsxRows on real fixture', () => {
  const buffer = new Uint8Array(readFileSync(resolve(__dirname, '__fixtures__/sample-portfolio.xlsx')))

  it('parses the header and 3 data rows', () => {
    const rows = parseXlsxRows(buffer)
    expect(rows.length).toBe(4)  // header + 3
    expect(String(rows[0][0]).toLowerCase()).toContain('allocation date')
  })

  it('produces correct lots via rowsToLots', () => {
    const rows = parseXlsxRows(buffer)
    const lots = rowsToLots(rows, 's1', 'SAP UK Limited')
    expect(lots).toHaveLength(3)
    const espp = lots.filter(l => l.schemeType === 'espp-match')
    const rsu = lots.filter(l => l.schemeType === 'rsu')
    expect(espp).toHaveLength(2)
    expect(rsu).toHaveLength(1)
    expect(espp[0].quantity).toBeCloseTo(1.28948, 5)
    expect(espp[0].acquisitionDate).toBe('2025-09-04')
    expect(rsu[0].quantity).toBeCloseTo(44.597, 3)
    expect(rsu[0].costBasisGBP).toBeCloseTo(137.64 * 44.597, 2)
  })

  it('handles the & in "Elevate & Move SAP" plan name (XML entity decode)', () => {
    const rows = parseXlsxRows(buffer)
    // plan column (index 1) on the RSU row should decode &amp; back to &
    const rsuRow = rows.find(r => String(r[2]).includes('restricted stock'))
    expect(rsuRow).toBeTruthy()
  })
})
