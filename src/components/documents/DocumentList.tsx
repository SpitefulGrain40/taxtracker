import { FileText, Table } from 'lucide-react'
import { StatusDot } from '../ui/StatusDot'

export interface DocItem {
  name: string
  meta: string
  status: 'green' | 'yellow' | 'gray'
  kind: 'pdf' | 'csv'
}

interface Props {
  items: DocItem[]
}

export function DocumentList({ items }: Props) {
  return (
    <div className="divide-y divide-white/[0.04]">
      {items.map((d, i) => (
        <div key={i} className={`flex items-center gap-3 px-5 py-3 ${d.status === 'gray' ? 'opacity-50' : ''}`}>
          <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${d.kind === 'csv' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
            {d.kind === 'csv' ? <Table size={15} /> : <FileText size={15} />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{d.name}</div>
            <div className="text-[11px] text-text-2 mt-0.5">{d.meta}</div>
          </div>
          <StatusDot status={d.status} />
        </div>
      ))}
    </div>
  )
}
