type Variant = 'default' | 'green' | 'yellow' | 'accent' | 'blue' | 'red'

const valueColours: Record<Variant, string> = {
  default: 'text-text-1',
  green: 'text-green',
  yellow: 'text-yellow',
  accent: 'text-accent',
  blue: 'text-blue',
  red: 'text-red',
}

interface Props {
  label: string
  value: string
  note?: React.ReactNode
  variant?: Variant
  progress?: number // 0–100, shows a progress bar if provided
  icon?: React.ReactNode
}

export function StatCard({ label, value, note, variant = 'default', progress, icon }: Props) {
  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium tracking-[0.06em] uppercase text-text-2">{label}</span>
        {icon && <span className="text-text-3">{icon}</span>}
      </div>
      <div className={`font-serif text-[30px] leading-none tracking-[-0.03em] mb-1.5 ${valueColours[variant]}`}>
        {value}
      </div>
      {note && <div className="text-[12px] text-text-2">{note}</div>}
      {progress !== undefined && (
        <div className="mt-3.5 h-[2px] bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
