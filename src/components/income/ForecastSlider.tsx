import { useState } from 'react'
import { incomeTax, employeeNI, effectivePersonalAllowance } from '../../lib/taxCalc'
import { CURRENT_RATES as R } from '../../lib/taxRates'

interface Props {
  baseIncome: number
}

export function ForecastSlider({ baseIncome }: Props) {
  const [extra, setExtra] = useState(0)
  const projected = baseIncome + extra
  const paNow = effectivePersonalAllowance(baseIncome, R)
  const paThen = effectivePersonalAllowance(projected, R)
  const taxNow = incomeTax(baseIncome, paNow, R) + employeeNI(baseIncome, R)
  const taxThen = incomeTax(projected, paThen, R) + employeeNI(projected, R)
  const extraTax = taxThen - taxNow
  const takeHome = extra - extraTax
  const effectiveRate = extra > 0 ? (extraTax / extra) * 100 : 0
  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h3 className="font-serif text-base mb-1">What if I earned more?</h3>
      <p className="text-text-2 text-xs mb-4">See how a pay rise or bonus affects your take-home after tax and National Insurance.</p>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-2">Extra income</span>
        <span className="font-mono text-accent">{gbp(extra)}</span>
      </div>
      <input type="range" min={0} max={50000} step={500} value={extra} onChange={e => setExtra(parseInt(e.target.value))} className="w-full accent-[#C8804A] mb-4" />
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-serif text-lg text-yellow">{gbp(extraTax)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Extra tax + NI</div>
        </div>
        <div>
          <div className="font-serif text-lg text-green">{gbp(takeHome)}</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">You keep</div>
        </div>
        <div>
          <div className="font-serif text-lg text-text-1">{effectiveRate.toFixed(0)}%</div>
          <div className="text-[10px] uppercase tracking-wide text-text-2 mt-1">Effective rate</div>
        </div>
      </div>
    </div>
  )
}
