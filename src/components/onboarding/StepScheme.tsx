import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import type { ShareSchemeConfig, SchemeType } from '../../types'

interface Props {
  employerName: string
  onNext: (schemes: ShareSchemeConfig[]) => void
  onSkip: () => void
}

const SCHEME_TYPES: { value: SchemeType; label: string; description: string }[] = [
  { value: 'espp-match', label: 'ESPP — employer match', description: "You contribute monthly, employer adds matching shares. No discount — company tops up your contribution." },
  { value: 'espp-discounted', label: 'ESPP — discounted purchase', description: "Shares bought at a discount to market price (e.g. 15% off). Income tax applies on the discount." },
  { value: 'rsu', label: 'RSU — restricted stock units', description: "Shares vest over time. Income tax + NI applies on the full market value at each vest date." },
  { value: 'csop', label: 'CSOP / EMI / SAYE', description: "Company Share Option Plan, Enterprise Management Incentives, or Save As You Earn scheme." },
]

const CURRENCIES = ['USD', 'GBP', 'EUR']
const BROKERS = ['Fidelity', 'E*Trade', 'Morgan Stanley', 'Other']
const EXCHANGES = ['NYSE', 'NASDAQ', 'LSE', 'Other']

function newScheme(employerName: string): Partial<ShareSchemeConfig> {
  return { employerName, currency: 'USD', exchange: 'NYSE', broker: 'Fidelity', active: true }
}

export function StepScheme({ employerName, onNext, onSkip }: Props) {
  const [schemes, setSchemes] = useState<ShareSchemeConfig[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Partial<ShareSchemeConfig>>(newScheme(employerName))

  const addScheme = () => {
    if (!draft.schemeType) return
    const scheme: ShareSchemeConfig = {
      id: crypto.randomUUID(),
      employerName: draft.employerName ?? employerName,
      schemeType: draft.schemeType,
      discountRate: draft.discountRate,
      currency: draft.currency ?? 'USD',
      exchange: draft.exchange ?? 'NYSE',
      broker: draft.broker ?? 'Other',
      active: true,
    }
    setSchemes(prev => [...prev, scheme])
    setAdding(false)
    setDraft(newScheme(employerName))
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Share schemes</h3>
        <p className="text-text-2 text-sm">Add any employee share schemes you participate in. This sets the tax rules for every lot imported.</p>
      </div>

      {schemes.length > 0 && (
        <div className="space-y-2">
          {schemes.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-white/[0.06]">
              <Check size={14} className="text-green flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{s.employerName}</p>
                <p className="text-xs text-text-2">{SCHEME_TYPES.find(t => t.value === s.schemeType)?.label} · {s.currency} · {s.broker}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 p-4 bg-surface rounded-xl border border-accent/20">
          <p className="text-sm font-medium">Add scheme</p>
          <div>
            <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Scheme type</label>
            <div className="space-y-2">
              {SCHEME_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setDraft(d => ({ ...d, schemeType: t.value }))}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${draft.schemeType === t.value ? 'border-accent bg-accent/10 text-text-1' : 'border-white/10 text-text-2 hover:border-white/20'}`}
                >
                  <p className="font-medium text-text-1">{t.label}</p>
                  <p className="text-xs text-text-2 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
          {draft.schemeType === 'espp-discounted' && (
            <div>
              <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Discount rate (%)</label>
              <input
                type="number" min={1} max={50}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
                placeholder="15"
                value={draft.discountRate ? draft.discountRate * 100 : ''}
                onChange={e => setDraft(d => ({ ...d, discountRate: parseFloat(e.target.value) / 100 || undefined }))}
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Currency', key: 'currency' as const, options: CURRENCIES },
              { label: 'Exchange', key: 'exchange' as const, options: EXCHANGES },
              { label: 'Broker', key: 'broker' as const, options: BROKERS },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">{f.label}</label>
                <select
                  className="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm text-text-1 focus:outline-none focus:border-accent/50"
                  value={draft[f.key] as string ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                >
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addScheme} disabled={!draft.schemeType}
              className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm disabled:opacity-40 hover:opacity-90">
              Add scheme
            </button>
            <button onClick={() => setAdding(false)} className="px-4 border border-white/10 rounded-lg text-sm text-text-2">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full border border-dashed border-accent/30 rounded-xl py-3 text-sm text-accent hover:border-accent/60 hover:bg-accent/5 transition-all flex items-center justify-center gap-2">
          <Plus size={14} />
          Add a share scheme
        </button>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onNext(schemes)}
          className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          {schemes.length > 0 ? 'Continue' : 'No schemes — continue'}
        </button>
      </div>
      <button onClick={onSkip} className="w-full text-text-2 text-sm py-1 hover:text-text-1">
        Add schemes later in Settings
      </button>
    </div>
  )
}
