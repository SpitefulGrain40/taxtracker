import * as XLSX from 'xlsx'
import type { ShareLot, SchemeType } from '../types'

/** Excel serial date (epoch 1899-12-30) → ISO yyyy-mm-dd. */
export function excelToISO(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
  return d.toISOString().slice(0, 10)
}

type Row = (string | number | null)[]

const COL = {
  allocationDate: 0,
  instrumentType: 2,
  costBasis: 6,
  marketPrice: 7,
  quantity: 10,
}

/** Determine scheme type from the instrument-type column text. */
function schemeTypeFor(instrumentType: string): SchemeType {
  const t = instrumentType.toLowerCase()
  if (t.includes('restricted stock') || t.includes('rsu')) return 'rsu'
  return 'espp-match'
}

/**
 * Convert parsed portfolio rows (first row = header) into ShareLots.
 * SAP export: ESPP months produce Purchase + Company match rows; RSU awards produce
 * one row per tranche. Cost basis and market price are already in GBP (XETRA).
 */
export function rowsToLots(rows: Row[], schemeId: string, employerName: string): ShareLot[] {
  const dataRows = rows.slice(1) // drop header
  const lots: ShareLot[] = []
  for (const row of dataRows) {
    const dateCell = row[COL.allocationDate]
    const qty = Number(row[COL.quantity])
    const cost = Number(row[COL.costBasis])
    const market = Number(row[COL.marketPrice])
    const instrumentType = String(row[COL.instrumentType] ?? '')
    if (typeof dateCell !== 'number' || !Number.isFinite(qty) || qty <= 0) continue

    const schemeType = schemeTypeFor(instrumentType)
    // RSU cost basis is the market value at vest (the "Strike price / Cost basis" col
    // holds the vest price for RSUs); ESPP cost basis is the purchase price.
    const perShareGBP = Number.isFinite(cost) && cost > 0 ? cost : market
    lots.push({
      id: crypto.randomUUID(),
      schemeId,
      employerName,
      schemeType,
      acquisitionDate: excelToISO(dateCell),
      acquisitionPriceOriginal: perShareGBP,
      acquisitionPriceFX: 1,          // GBP — no conversion for SAP/XETRA
      acquisitionPriceGBP: perShareGBP,
      quantity: qty,
      costBasisGBP: perShareGBP * qty,
    })
  }
  return lots
}

/** Parse an uploaded XLSX File into rows, then into lots. */
export async function parsePortfolioFile(file: File, schemeId: string, employerName: string): Promise<ShareLot[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: null })
  // Find the header row (the one containing "Allocation date")
  const headerIdx = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('allocation date')))
  const relevant = headerIdx >= 0 ? rows.slice(headerIdx) : rows
  return rowsToLots(relevant, schemeId, employerName)
}
