import { useState } from 'react'
import type { Profile } from '../../types'

type IncomeSource = Profile['otherIncomeSources'][number]

interface Props {
  onNext: (sources: IncomeSource[]) => void
}

const OPTIONS: { value: IncomeSource; label: string; description: string }[] = [
  { value: 'dividends', label: 'Dividends', description: 'Payments from shares you own in companies' },
  { value: 'savings', label: 'Savings interest', description: 'Interest from savings accounts or Cash ISAs' },
  { value: 'cgt', label: 'Capital gains', description: 'Profit from selling shares or other investments' },
  { value: 'rsu-vests', label: 'RSU / share vests', description: 'Shares vesting from a company scheme (separate to PAYE payslips)' },
  { value: 'benefits', label: 'Benefits in kind (P11D)', description: 'Company car, private medical insurance, expense reimbursements' },
]

export function StepIncome({ onNext }: Props) {
  const [selected, setSelected] = useState<Set<IncomeSource>>(new Set())

  const toggle = (v: IncomeSource) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Other income sources</h3>
        <p className="text-text-2 text-sm">Tick anything that applies to you. This tells us which parts of your Self Assessment to fill in.</p>
      </div>
      <div className="space-y-2">
        {OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${selected.has(o.value) ? 'border-accent bg-accent/10' : 'border-white/[0.06] hover:border-white/10'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${selected.has(o.value) ? 'bg-accent border-accent' : 'border-white/20'}`}>
                {selected.has(o.value) && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-bg" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs text-text-2 mt-0.5">{o.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={() => onNext([...selected])}
        className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
      >
        Continue
      </button>
    </div>
  )
}
