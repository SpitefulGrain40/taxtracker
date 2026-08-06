import { useSelectedTaxYear } from '../../hooks/useSelectedTaxYear'
import { getTaxYearLabel } from '../../lib/taxYears'
import type { TaxYearKey } from '../../types'
import { JargonTip } from './JargonTip'

export function TaxYearSelector() {
  const { year, setYear, years } = useSelectedTaxYear()

  return (
    <div className="flex items-center gap-2">
      <JargonTip
        term="tax year"
        explanation="The UK tax year runs 6 April to 5 April the next year."
      />
      <select
        value={year}
        onChange={e => setYear(e.target.value as TaxYearKey)}
        className="bg-surface border border-white/10 rounded-lg text-text-1 font-mono text-xs px-2 py-1"
      >
        {years.map(y => (
          <option key={y} value={y}>
            {getTaxYearLabel(y)}
          </option>
        ))}
      </select>
    </div>
  )
}
