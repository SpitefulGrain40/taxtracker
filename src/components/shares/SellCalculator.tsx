import { useState, useEffect } from 'react'
import { JargonTip } from '../ui/JargonTip'
import { section104Pool, disposalGain, cgtOnDisposal } from '../../lib/cgt'
import { CURRENT_RATES as R } from '../../lib/taxRates'
import type { ShareLot } from '../../types'
import type { Band } from '../../lib/taxCalc'

interface Props {
  lots: ShareLot[]
  currentPrice: number      // market price per share (GBP)
  band: Band
}

export function SellCalculator({ lots, currentPrice, band }: Props) {
  const pool = section104Pool(lots)
  const [qty, setQty] = useState(0)
  const [price, setPrice] = useState(currentPrice)

  // Re-sync when the parent's price changes — e.g. when async FX resolves and
  // the price flips from a native fallback to a GBP-converted figure.
  useEffect(() => { setPrice(currentPrice) }, [currentPrice])

  const g = disposalGain(pool, qty, price)
  const cgt = cgtOnDisposal(Math.max(0, g.gain), band, 0, R)
  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const maxQty = Math.floor(pool.quantity)

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h3 className="font-serif text-base mb-1">If I sell shares today…</h3>
      <p className="text-text-2 text-xs mb-4">
        Estimates the <JargonTip term="capital gains tax" explanation="Tax on the profit when you sell shares. The first £3,000 of gains each year is tax-free; the rest is taxed at 18% (basic rate) or 24% (higher rate)." /> using your average cost across all holdings.
      </p>

      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-2">Shares to sell (max {maxQty})</span>
            <span className="font-mono text-accent">{qty}</span>
          </div>
          <input type="range" min={0} max={maxQty} step={1} value={qty} onChange={e => setQty(parseInt(e.target.value))} className="w-full accent-[#C8804A]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-2 flex-1">Price per share</span>
          <span className="font-mono text-xs text-text-2">£</span>
          <input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} step={0.01}
            className="w-24 bg-bg border border-white/10 rounded px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-accent/50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center border-t border-white/[0.06] pt-4">
        <div>
          <div className="font-serif text-lg">{gbp(g.proceeds)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Proceeds</div>
        </div>
        <div>
          <div className={`font-serif text-lg ${g.gain >= 0 ? 'text-green' : 'text-red'}`}>{gbp(g.gain)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Gain</div>
        </div>
        <div>
          <div className="font-serif text-lg text-text-1">{gbp(cgt.exemptionApplied)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Tax-free allowance used</div>
        </div>
        <div>
          <div className="font-serif text-lg text-yellow">{gbp(cgt.tax)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">CGT owed</div>
        </div>
      </div>
    </div>
  )
}
