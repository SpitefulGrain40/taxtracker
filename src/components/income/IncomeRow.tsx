interface Props {
  name: string
  detail?: string
  source: string
  amount: number | null
}

export function IncomeRow({ name, detail, source, amount }: Props) {
  const gbp = amount == null ? '—' : `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 border-b border-white/[0.06] last:border-0 hover:bg-surface-2 transition-colors text-sm">
      <div>
        <div className="font-medium">{name}</div>
        {detail && <div className="text-[11px] text-text-2 mt-0.5">{detail}</div>}
      </div>
      <div className="font-mono text-[10px] tracking-wide text-text-3 text-right">{source}</div>
      <div className={`font-mono text-right whitespace-nowrap ${amount == null ? 'text-text-3' : ''}`}>{gbp}</div>
    </div>
  )
}
