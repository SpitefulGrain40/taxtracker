export type Period = 'month' | 'ytd' | 'projected'

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'projected', label: 'Projected' },
]

interface Props {
  value: Period
  onChange: (p: Period) => void
}

export function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-white/[0.06]">
      {OPTIONS.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-accent text-bg' : 'text-text-2 hover:text-text-1'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
