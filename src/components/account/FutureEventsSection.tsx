import { useState } from 'react'
import { Check, TriangleAlert, Trash2 } from 'lucide-react'
import { JargonTip } from '../ui/JargonTip'
import { parseMoney } from '../../lib/money'
import { getTaxYearEndDate, getTaxYearLabel, getTaxYearStartDate } from '../../lib/taxYears'
import type { FutureIncomeEvent, FutureIncomeEventType, TaxYearKey } from '../../types'

interface Props {
  events: FutureIncomeEvent[]
  taxYearKey: TaxYearKey
  onSave: (events: FutureIncomeEvent[]) => Promise<void>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const inputClass =
  'w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:border-accent/50'
const numericInputClass = `${inputClass} font-mono`
const labelClass = 'block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5'

const TYPE_LABELS: Record<FutureIncomeEventType, string> = {
  bonus: 'Bonus',
  'pay-rise': 'Pay rise',
  'rsu-vest': 'RSU vest',
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)

// Event dates are date-only ISO strings, parsed as UTC midnight. Format in UTC
// so a browser west of Greenwich doesn't render them a day early.
const formatDate = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const toIsoDay = (d: Date) => d.toISOString().slice(0, 10)

function helperForType(type: FutureIncomeEventType) {
  switch (type) {
    case 'bonus':
      return 'A one-off bonus payment. It is added to your projected year-end income and taxed (and subject to National Insurance) like normal pay.'
    case 'pay-rise':
      return 'Enter your new ANNUAL SALARY after the rise — not the size of the increase. For example, going from £60,000 to £63,000 means entering 63000, not 3000. Entering the increase instead will make the year-end projection badly wrong.'
    case 'rsu-vest':
      return 'The value of shares vesting on this date. Treated like a bonus — taxed and subject to National Insurance at vest, and added to your projected year-end income.'
  }
}

export function FutureEventsSection({ events, taxYearKey, onSave }: Props) {
  const [items, setItems] = useState<FutureIncomeEvent[]>(events)

  const [type, setType] = useState<FutureIncomeEventType>('bonus')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [addError, setAddError] = useState('')

  const [state, setState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleAdd = () => {
    if (!label.trim()) {
      setAddError('Give this event a label.')
      return
    }
    const parsedAmount = parseMoney(amount)
    if (parsedAmount === null) {
      setAddError("Check the amount — it isn't a valid number.")
      return
    }
    // parseMoney treats blank as 0, which is right for payslip fields but wrong
    // here: a zero pay rise would be projected as £0/year of future pay and
    // silently wipe out the shortfall warning.
    if (parsedAmount <= 0) {
      setAddError("Enter the amount — it can't be blank or zero.")
      return
    }
    if (!effectiveDate) {
      setAddError('Pick an effective date.')
      return
    }
    // The event is tagged with `taxYearKey` and projection.ts filters on that tag
    // alone. A date outside the tagged year would be counted in the wrong year —
    // an earlier date double-counts against YTD figures that already include it.
    const startIso = toIsoDay(getTaxYearStartDate(taxYearKey))
    const endIso = toIsoDay(getTaxYearEndDate(taxYearKey))
    if (effectiveDate < startIso || effectiveDate > endIso) {
      setAddError(
        `The date must fall in the ${getTaxYearLabel(taxYearKey)} tax year — between ${formatDate(startIso)} and ${formatDate(endIso)}.`
      )
      return
    }

    const newEvent: FutureIncomeEvent = {
      id: crypto.randomUUID(),
      type,
      label: label.trim(),
      amount: parsedAmount,
      effectiveDate,
      taxYear: taxYearKey,
      subjectToNI: true,
    }
    setItems(prev => [...prev, newEvent])
    setLabel('')
    setAmount('')
    setEffectiveDate('')
    setType('bonus')
    setAddError('')
    setState('idle')
  }

  const handleRemove = (id: string) => {
    setItems(prev => prev.filter(e => e.id !== id))
    setState('idle')
  }

  const handleSave = async () => {
    setState('saving')
    try {
      await onSave(items)
      setState('saved')
    } catch {
      setErrorMessage("Couldn't save — check your connection and try again.")
      setState('error')
    }
  }

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h2 className="font-serif text-base mb-1">Future income</h2>
      <p className="text-text-2 text-xs mb-4">
        Tell the app about income you're expecting but haven't been paid yet — a bonus, a pay rise, or an{' '}
        <JargonTip term="RSU vest" explanation="When Restricted Stock Units 'vest', they become yours and their value is taxed as income at that point — like a bonus paid in shares." />.
        This lets the year-end projection warn you ahead of time if you're on track for a tax shortfall.
      </p>

      {items.length === 0 && (
        <div className="bg-bg border border-white/[0.06] rounded-lg p-4 mb-4 text-text-2 text-sm">
          No future income events yet. Adding an expected bonus, pay rise or RSU vest here lets the app project
          your likely year-end tax position and warn you in advance if you'll owe more than what's being deducted
          from your pay.
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2 mb-4">
          {items.map(event => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-3 bg-bg border border-white/[0.06] rounded-lg px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-1 truncate">{event.label}</span>
                  <span className="text-[11px] uppercase tracking-[.06em] text-text-2 bg-white/[0.04] rounded px-1.5 py-0.5 shrink-0">
                    {TYPE_LABELS[event.type]}
                  </span>
                </div>
                <div className="text-text-2 text-xs mt-0.5">{formatDate(event.effectiveDate)}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-sm text-text-1">{formatMoney(event.amount)}</span>
                <button
                  onClick={() => handleRemove(event.id)}
                  aria-label={`Remove ${event.label}`}
                  className="text-text-2 hover:text-red transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-white/[0.06]">
        <p className="text-[11px] uppercase tracking-[.06em] text-text-2 mb-3">Add an event</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <select
                className={inputClass}
                value={type}
                onChange={e => setType(e.target.value as FutureIncomeEventType)}
              >
                <option value="bonus">Bonus</option>
                <option value="pay-rise">Pay rise</option>
                <option value="rsu-vest">RSU vest</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Label</label>
              <input
                className={inputClass}
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Annual bonus"
              />
            </div>
          </div>

          <p className="text-text-2 text-xs">{helperForType(type)}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{type === 'pay-rise' ? 'New annual salary' : 'Amount'}</label>
              <input
                inputMode="numeric"
                className={numericInputClass}
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={type === 'pay-rise' ? '63000' : '5000'}
              />
            </div>
            <div>
              <label className={labelClass}>Effective date</label>
              <input
                type="date"
                className={inputClass}
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAdd}
              className="bg-white/[0.06] text-text-1 font-semibold py-2 px-4 rounded-lg text-sm hover:bg-white/[0.1] transition-colors"
            >
              Add
            </button>
            {addError && (
              <span className="flex items-center gap-1.5 text-red text-xs">
                <TriangleAlert size={14} /> {addError}
              </span>
            )}
          </div>
        </div>
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
