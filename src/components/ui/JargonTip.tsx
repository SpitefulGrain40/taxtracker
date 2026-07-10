import { Info } from 'lucide-react'
import { useState } from 'react'

interface Props {
  term: string
  explanation: string
}

export function JargonTip({ term, explanation }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline">
      <span
        className="border-b border-dashed border-accent cursor-help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onTouchStart={() => setVisible(v => !v)}
      >
        {term}
      </span>
      {visible && (
        <span className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-60 bg-surface-3 border border-accent/30 rounded-lg p-3 text-[12px] leading-relaxed z-50 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-text-1 pointer-events-none">
          <span className="flex items-center gap-1.5 mb-1.5 font-semibold text-accent text-[12px]">
            <Info size={12} />
            {term}
          </span>
          {explanation}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-accent/30" />
        </span>
      )}
    </span>
  )
}
