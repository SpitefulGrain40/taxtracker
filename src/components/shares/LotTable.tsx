import type { ShareLot } from '../../types'

interface Props {
  lots: ShareLot[]
}

const schemeLabel: Record<string, string> = {
  'espp-match': 'ESPP (match)',
  'espp-discounted': 'ESPP (discounted)',
  'rsu': 'RSU',
  'csop': 'CSOP', 'emi': 'EMI', 'saye': 'SAYE',
}

export function LotTable({ lots }: Props) {
  const held = lots.filter(l => !l.disposalDate)
  if (held.length === 0) {
    return <p className="text-text-2 text-sm px-5 py-6">No share lots yet. Import a portfolio export to populate your register.</p>
  }
  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-text-2 border-b border-white/[0.06]">
            <th className="text-left font-medium px-5 py-2.5">Acquired</th>
            <th className="text-left font-medium px-3 py-2.5">Scheme</th>
            <th className="text-right font-medium px-3 py-2.5">Qty</th>
            <th className="text-right font-medium px-3 py-2.5">Cost/share</th>
            <th className="text-right font-medium px-5 py-2.5">Cost basis</th>
          </tr>
        </thead>
        <tbody>
          {held.map(l => (
            <tr key={l.id} className="border-b border-white/[0.04] hover:bg-surface-2 transition-colors">
              <td className="px-5 py-2.5 font-mono text-xs">{l.acquisitionDate}</td>
              <td className="px-3 py-2.5 text-text-2">{schemeLabel[l.schemeType] ?? l.schemeType}</td>
              <td className="px-3 py-2.5 text-right font-mono">{l.quantity.toFixed(4)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{gbp(l.acquisitionPriceGBP)}</td>
              <td className="px-5 py-2.5 text-right font-mono">{gbp(l.costBasisGBP)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
