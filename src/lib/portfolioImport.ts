import { unzipSync, strFromU8 } from 'fflate'
import type { ShareLot, SchemeType } from '../types'

/** Excel serial date (epoch 1899-12-30) → ISO yyyy-mm-dd. */
export function excelToISO(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
  return d.toISOString().slice(0, 10)
}

export type Row = (string | number | null)[]

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
  const buffer = new Uint8Array(await file.arrayBuffer())
  const rows = parseXlsxRows(buffer)
  const headerIdx = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('allocation date')))
  const relevant = headerIdx >= 0 ? rows.slice(headerIdx) : rows
  return rowsToLots(relevant, schemeId, employerName)
}

/**
 * Minimal, dependency-light XLSX reader. An XLSX file is a ZIP of XML parts;
 * we unzip with fflate, read the shared-strings table and the first worksheet,
 * and reconstruct the cell grid. Input is the user's own small file with a
 * known structure, so regex-based XML extraction is acceptable here.
 */
export function parseXlsxRows(buffer: Uint8Array): Row[] {
  const files = unzipSync(buffer)
  // shared strings
  const sstXml = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : ''
  const shared: string[] = []
  // Each <si> may contain one or more <t>...</t>; concatenate the t's within an si.
  const siRegex = /<si>(.*?)<\/si>/gs
  let siMatch: RegExpExecArray | null
  while ((siMatch = siRegex.exec(sstXml)) !== null) {
    const texts = [...siMatch[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(m => decodeXml(m[1]))
    shared.push(texts.join(''))
  }
  // worksheet — find the first sheet xml
  const sheetKey = Object.keys(files).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
  if (!sheetKey) return []
  const sheetXml = strFromU8(files[sheetKey])
  const rows: Row[] = []
  const rowRegex = /<row[^>]*>(.*?)<\/row>/gs
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const cells: Row = []
    const cellRegex = /<c\s+r="([A-Z]+)\d+"(?:\s+t="([^"]*)")?[^>]*>(?:<v>(.*?)<\/v>)?<\/c>/gs
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const col = colToIndex(cellMatch[1])
      const type = cellMatch[2]
      const raw = cellMatch[3]
      let value: string | number | null = null
      if (raw !== undefined) {
        if (type === 's') value = shared[parseInt(raw, 10)] ?? null
        else value = Number(raw)
      }
      cells[col] = value
    }
    // fill any holes with null
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = null
    rows.push(cells)
  }
  return rows
}

function colToIndex(col: string): number {
  let n = 0
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function decodeXml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}
