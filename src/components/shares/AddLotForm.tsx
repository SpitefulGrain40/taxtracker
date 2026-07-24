import { useMemo, useState } from 'react'
import { Check, Loader2, Plus, TriangleAlert } from 'lucide-react'
import { JargonTip } from '../ui/JargonTip'
import { buildManualLot } from '../../lib/lotBuilder'
import { parseMoney } from '../../lib/money'
import { SCHEME_TYPE_LABELS } from '../../lib/schemeLabels'
import type { ShareLot, ShareSchemeConfig } from '../../types'

interface Props {
  schemes: ShareSchemeConfig[]
  onAdd: (lot: ShareLot) => Promise<void>
}

type AddState = 'idle' | 'adding' | 'added' | 'error'

const inputClass =
  'w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:border-accent/50'
const numericInputClass = `${inputClass} font-mono`
const labelClass = 'block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5'

export function AddLotForm({ schemes, onAdd }: Props) {
  const [schemeId, setSchemeId] = useState(schemes[0]?.id ?? '')
  const [acquisitionDate, setAcquisitionDate] = useState('')
  const [quantityStr, setQuantityStr] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [fxStr, setFxStr] = useState('1')
  const [errorMsg, setErrorMsg] = useState('')
  const [state, setState] = useState<AddState>('idle')

  const scheme = schemes.find(s => s.id === schemeId)

  if (schemes.length === 0) {
    return (
      <div className="bg-bg border border-white/[0.06] rounded-lg p-4 text-sm text-text-2">
        No share schemes set up yet. Add a scheme in <span className="text-text-1 font-medium">Account → Share schemes</span> before you can record a lot by hand.
      </div>
    )
  }

  const isGbp = scheme?.currency === 'GBP'
  const missingDiscount = scheme?.schemeType === 'espp-discounted' && scheme.discountRate == null

  const quantity = parseMoney(quantityStr)
  const price = parseMoney(priceStr)
  const fx = isGbp ? 1 : parseMoney(fxStr)

  const preview = useMemo(() => {
    if (!scheme || missingDiscount) return null
    if (quantity == null || quantity <= 0) return null
    if (price == null || price <= 0) return null
    if (fx == null || fx <= 0) return null
    if (!acquisitionDate) return null
    return buildManualLot({
      schemeId: scheme.id,
      employerName: scheme.employerName,
      schemeType: scheme.schemeType,
      discountRate: scheme.discountRate,
      acquisitionDate,
      quantity,
      marketPricePerShare: price,
      fxToGBP: fx,
    })
  }, [scheme, missingDiscount, quantity, price, fx, acquisitionDate])

  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const resetFields = () => {
    setAcquisitionDate('')
    setQuantityStr('')
    setPriceStr('')
    setFxStr('1')
  }

  const handleAdd = async () => {
    setErrorMsg('')
    if (!scheme) { setErrorMsg('Choose a scheme.'); setState('error'); return }
    if (missingDiscount) {
      setErrorMsg(`Set the discount % for ${scheme.employerName} in Account → Share schemes before adding a discounted-ESPP lot.`)
      setState('error')
      return
    }
    if (!acquisitionDate) { setErrorMsg('Enter the acquisition date.'); setState('error'); return }
    if (quantity == null) { setErrorMsg('Quantity must be a number.'); setState('error'); return }
    if (quantity <= 0) { setErrorMsg('Quantity must be greater than 0.'); setState('error'); return }
    if (price == null) { setErrorMsg('Market price must be a number.'); setState('error'); return }
    if (price <= 0) { setErrorMsg('Market price must be greater than 0.'); setState('error'); return }
    if (!isGbp) {
      if (fx == null) { setErrorMsg('FX rate must be a number.'); setState('error'); return }
      if (fx <= 0) { setErrorMsg('FX rate must be greater than 0.'); setState('error'); return }
    }

    const built = buildManualLot({
      schemeId: scheme.id,
      employerName: scheme.employerName,
      schemeType: scheme.schemeType,
      discountRate: scheme.discountRate,
      acquisitionDate,
      quantity,
      marketPricePerShare: price,
      fxToGBP: fx ?? 1,
    })

    setState('adding')
    try {
      await onAdd(built.lot)
      setState('added')
      resetFields()
    } catch (e) {
      setErrorMsg(String(e))
      setState('error')
    }
  }

  return (
    <div className="bg-bg border border-white/[0.06] rounded-lg p-4 space-y-3">
      <h3 className="font-serif text-base">Add a lot by hand</h3>
      <p className="text-text-2 text-xs">
        Record a purchase or vest for any scheme, broker, or currency — useful for schemes without an automatic
        import, like a{' '}
        <JargonTip
          term="ESPP"
          explanation="An Employee Share Purchase Plan lets you buy your employer's shares, sometimes at a discount to the market price. The discount is taxed as income when you buy."
        />{' '}
        held in a different currency.
      </p>

      <div>
        <label className={labelClass}>Scheme</label>
        <select
          className={inputClass}
          value={schemeId}
          onChange={e => { setSchemeId(e.target.value); setState('idle'); setErrorMsg('') }}
        >
          {schemes.map(s => (
            <option key={s.id} value={s.id}>
              {s.employerName} — {SCHEME_TYPE_LABELS[s.schemeType]}
            </option>
          ))}
        </select>
      </div>

      {missingDiscount && (
        <div className="flex items-start gap-2 text-xs text-yellow bg-[rgba(200,154,58,0.10)] border border-[rgba(200,154,58,0.22)] rounded-lg p-3">
          <TriangleAlert size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Set the discount % for {scheme?.employerName} in Account → Share schemes before adding a lot — we won't
            guess at 0%.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Acquisition date</label>
          <input
            type="date"
            className={inputClass}
            value={acquisitionDate}
            onChange={e => { setAcquisitionDate(e.target.value); setState('idle'); setErrorMsg('') }}
          />
        </div>
        <div>
          <label className={labelClass}>Quantity</label>
          <input
            type="text"
            inputMode="decimal"
            className={numericInputClass}
            value={quantityStr}
            onChange={e => { setQuantityStr(e.target.value); setState('idle'); setErrorMsg('') }}
            placeholder="100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={isGbp ? 'col-span-2' : ''}>
          <label className={labelClass}>Market price per share ({scheme?.currency ?? '—'})</label>
          <input
            type="text"
            inputMode="decimal"
            className={numericInputClass}
            value={priceStr}
            onChange={e => { setPriceStr(e.target.value); setState('idle'); setErrorMsg('') }}
            placeholder="0.00"
          />
        </div>
        {!isGbp && (
          <div>
            <label className={labelClass}>
              <JargonTip
                term="FX rate to GBP"
                explanation="The exchange rate on the purchase date, not today's rate — HMRC's capital gains tax calculation uses the historical rate on the day you acquired the shares."
              />
            </label>
            <input
              type="text"
              inputMode="decimal"
              className={numericInputClass}
              value={fxStr}
              onChange={e => { setFxStr(e.target.value); setState('idle'); setErrorMsg('') }}
              placeholder="1.00"
            />
          </div>
        )}
      </div>

      {preview && (
        <div className="bg-surface border border-white/[0.06] rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-text-2">
              <JargonTip
                term="Cost basis"
                explanation="The GBP value used to calculate capital gains tax when you sell — the full market value of the shares at acquisition, converted at the FX rate on that date."
              />
            </span>
            <span className="font-mono text-text-1">{gbp(preview.marketValueGBP)}</span>
          </div>
          {preview.taxableIncomeGBP > 0 && (
            <div className="flex justify-between">
              <span className="text-text-2">Taxable income (at purchase)</span>
              <span className="font-mono text-text-1">{gbp(preview.taxableIncomeGBP)}</span>
            </div>
          )}
          <p className="text-text-2 pt-1">
            This income is normally taxed via PAYE at purchase; the cost basis above is what CGT uses when the
            shares are sold.
          </p>
        </div>
      )}

      {state === 'error' && errorMsg && (
        <div className="flex items-start gap-2 text-sm text-red">
          <TriangleAlert size={15} className="mt-0.5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleAdd}
          disabled={state === 'adding' || missingDiscount}
          className="flex items-center gap-1.5 bg-accent text-bg font-semibold py-2 px-4 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {state === 'adding' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {state === 'adding' ? 'Adding…' : 'Add lot'}
        </button>
        {state === 'added' && (
          <span className="flex items-center gap-1.5 text-green text-xs">
            <Check size={14} /> Added
          </span>
        )}
      </div>
    </div>
  )
}
