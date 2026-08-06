import { createContext, useContext, useState, type ReactNode } from 'react'
import type { TaxYearKey } from '../types'
import { getCurrentTaxYear, recentTaxYears } from '../lib/taxYears'

const KEY = 'tt_selected_year'
const YEARS = recentTaxYears(4)

interface Ctx { year: TaxYearKey; setYear: (y: TaxYearKey) => void; years: TaxYearKey[] }
const TaxYearContext = createContext<Ctx | null>(null)

export function TaxYearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<TaxYearKey>(() => {
    const stored = localStorage.getItem(KEY)
    return (stored && /^\d{4}-\d{2}$/.test(stored)) ? (stored as TaxYearKey) : getCurrentTaxYear()
  })
  const setYear = (y: TaxYearKey) => { localStorage.setItem(KEY, y); setYearState(y) }
  return <TaxYearContext.Provider value={{ year, setYear, years: YEARS }}>{children}</TaxYearContext.Provider>
}

export function useSelectedTaxYear(): Ctx {
  const ctx = useContext(TaxYearContext)
  if (!ctx) throw new Error('useSelectedTaxYear must be used within TaxYearProvider')
  return ctx
}
