import { AlertTriangle, ChevronRight } from 'lucide-react'

interface Props {
  variant: 'yellow' | 'accent'
  children: React.ReactNode
  action?: { label: string; onClick: () => void }
}

const styles = {
  yellow: 'bg-[rgba(200,154,58,0.10)] border border-[rgba(200,154,58,0.22)]',
  accent: 'bg-accent-soft border border-accent/28',
}

const iconStyles = {
  yellow: 'bg-[rgba(200,154,58,0.15)] text-yellow',
  accent: 'bg-accent-soft text-accent',
}

export function AlertStrip({ variant, children, action }: Props) {
  return (
    <div className={`flex items-center gap-3 px-[18px] py-[14px] rounded-[10px] text-[13px] ${styles[variant]}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconStyles[variant]}`}>
        <AlertTriangle size={16} />
      </div>
      <div className="flex-1">{children}</div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-accent text-[12px] font-medium flex items-center gap-1 flex-shrink-0 hover:underline"
        >
          {action.label}
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}
