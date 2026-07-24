import { useState } from 'react'
import { Check, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { JargonTip } from '../ui/JargonTip'
import { fractionToPercent, percentToFraction } from '../../lib/schemeEdit'
import { SCHEME_TYPE_LABELS } from '../../lib/schemeLabels'
import type { Profile, SchemeType, ShareSchemeConfig } from '../../types'

interface Props {
  profile: Profile
  onSave: (p: Profile) => Promise<void>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// A scheme being edited in the form. discountRate is held as the percentage
// string the input shows (e.g. "15"); it's converted to/from the stored
// fraction (0.15) only at the read/write boundary — see src/lib/schemeEdit.ts.
interface SchemeRow {
  id: string
  employerName: string
  schemeType: SchemeType
  discountRatePercent: string
  currency: string
  exchange: string
  ticker: string
  broker: string
  active: boolean
}

const SCHEME_TYPES = Object.keys(SCHEME_TYPE_LABELS) as SchemeType[]

const inputClass =
  'w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:border-accent/50'
const numericInputClass = `${inputClass} font-mono`
const labelClass = 'block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5'

function rowFromScheme(scheme: ShareSchemeConfig): SchemeRow {
  return {
    id: scheme.id,
    employerName: scheme.employerName,
    schemeType: scheme.schemeType,
    discountRatePercent: fractionToPercent(scheme.discountRate),
    currency: scheme.currency,
    exchange: scheme.exchange,
    ticker: scheme.ticker ?? '',
    broker: scheme.broker,
    active: scheme.active,
  }
}

function newRow(): SchemeRow {
  return {
    id: crypto.randomUUID(),
    employerName: '',
    schemeType: 'rsu',
    discountRatePercent: '',
    currency: '',
    exchange: '',
    ticker: '',
    broker: '',
    active: true,
  }
}

export function SchemesSection({ profile, onSave }: Props) {
  const [rows, setRows] = useState<SchemeRow[]>(() => profile.schemes.map(rowFromScheme))
  const [state, setState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const updateRow = (id: string, patch: Partial<SchemeRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
    setState('idle')
  }

  const handleAdd = () => {
    setRows(prev => [...prev, newRow()])
    setState('idle')
  }

  const handleRemove = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
    setState('idle')
  }

  const handleSave = async () => {
    setErrorMessage('')

    const built: ShareSchemeConfig[] = []
    for (const row of rows) {
      const employerName = row.employerName.trim()
      if (!employerName) {
        setErrorMessage('Every scheme needs an employer name.')
        setState('error')
        return
      }

      // Currency drives both the FX conversion and the value shown on the Shares
      // screen, which falls back to GBP (the reference currency) when it's blank —
      // mispricing a USD/EUR holding as if it were GBP. Reject it rather than guess.
      const currency = row.currency.trim()
      if (!currency) {
        setErrorMessage(`${employerName} needs a currency — the code the shares are priced in, e.g. EUR or USD.`)
        setState('error')
        return
      }

      const scheme: ShareSchemeConfig = {
        id: row.id,
        employerName,
        schemeType: row.schemeType,
        currency,
        exchange: row.exchange.trim(),
        broker: row.broker.trim(),
        active: row.active,
      }

      const tickerTrimmed = row.ticker.trim()
      if (tickerTrimmed !== '') {
        scheme.ticker = tickerTrimmed
      }

      if (row.schemeType === 'espp-discounted') {
        const fraction = percentToFraction(row.discountRatePercent)
        if (row.discountRatePercent.trim() !== '' && fraction === null) {
          setErrorMessage(`Check the discount rate for ${employerName} — it isn't a valid percentage.`)
          setState('error')
          return
        }
        if (fraction !== null) {
          scheme.discountRate = fraction
        }
      }

      built.push(scheme)
    }

    setState('saving')
    try {
      await onSave({ ...profile, schemes: built })
      setState('saved')
    } catch {
      setErrorMessage("Couldn't save — check your connection and try again.")
      setState('error')
    }
  }

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h2 className="font-serif text-base mb-1">Share schemes</h2>
      <p className="text-text-2 text-xs mb-4">
        Set up each share scheme you're enrolled in — an{' '}
        <JargonTip
          term="ESPP"
          explanation="An Employee Share Purchase Plan lets you buy your employer's shares, sometimes with an employer match on top, sometimes at a discount to the market price. The discount or match is taxed as income when you buy."
        />{' '}
        or{' '}
        <JargonTip
          term="RSU"
          explanation="Restricted Stock Units are a promise of free shares that become yours ('vest') on a future date. Their full value is taxed as income at the moment they vest."
        />{' '}
        scheme, for example. This tells the Share Schemes screen how to tax each purchase or vest correctly, and
        it's yours to update whenever you change jobs.
      </p>

      {rows.length === 0 && (
        <div className="bg-bg border border-white/[0.06] rounded-lg p-4 mb-4 text-text-2 text-sm">
          No share schemes set up yet. Add one below for each employer you hold or held shares with.
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3 mb-4">
          {rows.map(row => (
            <div key={row.id} className="bg-bg border border-white/[0.06] rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-sm text-text-1 font-semibold truncate">
                  {row.employerName || 'New scheme'}
                </span>
                <button
                  onClick={() => handleRemove(row.id)}
                  aria-label={`Remove ${row.employerName || 'scheme'}`}
                  className="text-text-2 hover:text-red transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Employer</label>
                    <input
                      className={inputClass}
                      value={row.employerName}
                      onChange={e => updateRow(row.id, { employerName: e.target.value })}
                      placeholder="e.g. SAP UK Ltd"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Scheme type</label>
                    <select
                      className={inputClass}
                      value={row.schemeType}
                      onChange={e => updateRow(row.id, { schemeType: e.target.value as SchemeType })}
                    >
                      {SCHEME_TYPES.map(type => (
                        <option key={type} value={type}>
                          {SCHEME_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {row.schemeType === 'espp-discounted' && (
                  <div>
                    <label className={labelClass}>Discount rate (%)</label>
                    <input
                      inputMode="numeric"
                      className={numericInputClass}
                      value={row.discountRatePercent}
                      onChange={e =>
                        updateRow(row.id, { discountRatePercent: e.target.value.replace(/[^0-9.]/g, '') })
                      }
                      placeholder="15"
                    />
                    <p className="text-text-2 text-xs mt-1.5">
                      The percentage discount off market price you pay at purchase — this discount is taxed as
                      income.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Currency</label>
                    <input
                      className={numericInputClass}
                      value={row.currency}
                      onChange={e => updateRow(row.id, { currency: e.target.value.toUpperCase() })}
                      placeholder="EUR"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Exchange</label>
                    <input
                      className={inputClass}
                      value={row.exchange}
                      onChange={e => updateRow(row.id, { exchange: e.target.value })}
                      placeholder="XETRA"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Ticker</label>
                    <input
                      className={inputClass}
                      value={row.ticker}
                      onChange={e => updateRow(row.id, { ticker: e.target.value })}
                      placeholder="e.g. SAP.DE or AAPL"
                    />
                    <p className="text-text-2 text-xs mt-1.5">
                      The market symbol for live prices, e.g. SAP.DE or AAPL — leave blank if you don't want live
                      pricing.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Broker</label>
                    <input
                      className={inputClass}
                      value={row.broker}
                      onChange={e => updateRow(row.id, { broker: e.target.value })}
                      placeholder="EquatePlus"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-text-1 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={e => updateRow(row.id, { active: e.target.checked })}
                    className="accent-accent w-4 h-4"
                  />
                  Active — still receiving shares under this scheme
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-white/[0.06]">
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 bg-white/[0.06] text-text-1 font-semibold py-2 px-4 rounded-lg text-sm hover:bg-white/[0.1] transition-colors"
        >
          <Plus size={14} /> Add scheme
        </button>
      </div>

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.06]">
        <button
          onClick={handleSave}
          disabled={state === 'saving'}
          className="bg-accent text-bg font-semibold py-2.5 px-5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {state === 'saved' && (
          <span className="flex items-center gap-1.5 text-green text-xs">
            <Check size={14} /> Saved
          </span>
        )}
        {state === 'error' && (
          <span className="flex items-center gap-1.5 text-red text-xs">
            <TriangleAlert size={14} /> {errorMessage}
          </span>
        )}
      </div>
    </div>
  )
}
