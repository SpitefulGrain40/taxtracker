import { useState } from 'react'
import { getCurrentTaxYear, getTaxYearEndDate } from '../../lib/taxYears'

interface Props {
  onNext: (data: { baseAnnualSalary: number | null; bonus: { amount: number; effectiveDate: string } | null }) => void
  onSkip: () => void
}

export function StepSalary({ onNext, onSkip }: Props) {
  const [salary, setSalary] = useState('')
  const [bonus, setBonus] = useState('')

  const submit = () => {
    const baseAnnualSalary = salary ? Number(salary) : null
    const bonusAmount = bonus ? Number(bonus) : null
    const effectiveDate = getTaxYearEndDate(getCurrentTaxYear()).toISOString().slice(0, 10)
    onNext({
      baseAnnualSalary: baseAnnualSalary && !Number.isNaN(baseAnnualSalary) ? baseAnnualSalary : null,
      bonus: bonusAmount && !Number.isNaN(bonusAmount) ? { amount: bonusAmount, effectiveDate } : null,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Salary &amp; expected bonus</h3>
        <p className="text-text-2 text-sm">Optional, but it makes your year-end projection far more accurate. Leave blank to estimate from your payslip.</p>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Annual base salary</label>
        <input inputMode="numeric" className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
          value={salary} onChange={e => setSalary(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="60000" />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Expected bonus this tax year</label>
        <input inputMode="numeric" className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
          value={bonus} onChange={e => setBonus(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="8000" />
      </div>
      <button onClick={submit} className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity">Continue</button>
      <button onClick={onSkip} className="w-full text-text-2 text-sm py-2 hover:text-text-1 transition-colors">Skip — I'll add this later</button>
    </div>
  )
}
