import { CheckCircle, ChevronRight } from 'lucide-react'

interface Field { label: string; value: string }

interface Props {
  title: string
  fields: Field[]
  onConfirm: () => void
  onCancel: () => void
}

export function ExtractReview({ title, fields, onConfirm, onCancel }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle size={16} className="text-green" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="bg-surface rounded-lg overflow-hidden border border-white/[0.06]">
        <div className="divide-y divide-white/[0.04]">
          {fields.map(f => (
            <div key={f.label} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-2">{f.label}</span>
              <span className="font-mono text-text-1">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onConfirm} className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          Looks right — save it
          <ChevronRight size={14} />
        </button>
        <button onClick={onCancel} className="px-4 border border-white/10 rounded-lg text-sm text-text-2 hover:text-text-1">Cancel</button>
      </div>
    </div>
  )
}
