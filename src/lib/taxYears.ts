import type { TaxYearKey } from '../types'

/** UK tax year starts 6 April. Returns key like "2025-26". */
export function getTaxYearKey(date: Date): TaxYearKey {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-indexed
  const day = date.getDate()
  const startsNewYear = month > 4 || (month === 4 && day >= 6)
  const startYear = startsNewYear ? year : year - 1
  return `${startYear}-${String(startYear + 1).slice(-2)}` as TaxYearKey
}

export function getCurrentTaxYear(): TaxYearKey {
  return getTaxYearKey(new Date())
}

export function getTaxYearLabel(key: TaxYearKey): string {
  return key.replace('-', '–')
}

export function getTaxYearStartDate(key: TaxYearKey): Date {
  const [startYear] = key.split('-')
  return new Date(`${startYear}-04-06`)
}

export function getTaxYearEndDate(key: TaxYearKey): Date {
  const [startYear] = key.split('-')
  const endYear = parseInt(startYear) + 1
  return new Date(`${endYear}-04-05`)
}

/** How many complete months into the current tax year are we? (April = 1) */
export function monthsIntoTaxYear(date: Date): number {
  const startDate = getTaxYearStartDate(getTaxYearKey(date))
  const months =
    (date.getFullYear() - startDate.getFullYear()) * 12 +
    (date.getMonth() - startDate.getMonth()) +
    1
  return Math.max(1, months)
}

/** Tax period number (April = 1, March = 12) */
export function getTaxPeriod(date: Date): number {
  const month = date.getMonth() + 1
  return month >= 4 ? month - 3 : month + 9
}

/** The current tax year key plus the previous (count-1) years, newest first. */
export function recentTaxYears(count: number): TaxYearKey[] {
  const [startStr] = getCurrentTaxYear().split('-')
  const start = parseInt(startStr, 10)
  return Array.from({ length: count }, (_, i) => {
    const y = start - i
    return `${y}-${String(y + 1).slice(-2)}` as TaxYearKey
  })
}
