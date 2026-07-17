import { StatusDot } from '../ui/StatusDot'
import type { ReturnSection as Section } from '../../lib/taxReturn'

interface Props {
  section: Section
}

export function ReturnSection({ section }: Props) {
  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <h2 className="font-serif text-base">{section.title}</h2>
        <div className="flex items-center gap-2">
          <StatusDot status={section.complete ? 'green' : 'yellow'} />
          <span className="text-[11px] text-text-2">{section.complete ? 'Ready' : 'Needs input'}</span>
        </div>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {section.boxes.map((b, i) => (
          <div key={i} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  {b.box !== '—' && <span className="font-mono text-[10px] text-text-3">Box {b.box}</span>}
                  <span className="text-sm font-medium">{b.label}</span>
                </div>
                <p className="text-[11px] text-text-2 mt-1">{b.plainEnglish}</p>
              </div>
              <div className={`font-mono text-sm whitespace-nowrap ${b.value == null ? 'text-text-3' : ''}`}>
                {b.value == null ? '—' : gbp(b.value)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
