import { useState } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { JargonTip } from '../ui/JargonTip'
import { Link } from 'react-router-dom'
import { applyPayslipEdits, findLatestPayslip } from '../../lib/payslipEdit'
import type { TaxYear } from '../../types'

interface Props {
  taxYear: TaxYear
  onSave: (ty: TaxYear) => Promise<void>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const numericInputClass =
  'w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50'
const labelClass = 'block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5'

// Empty means zero. Anything that isn't a clean number is rejected, never coerced.
const parseMoney = (raw: string): number | null => {
  const t = raw.trim()
  if (t === '') return 0
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function PayslipSection({ taxYear, onSave }: Props) {
  // Pinned once at mount so the edit target can never drift out from under the
  // form as `taxYear` changes across re-renders (e.g. after this component's
  // own save updates the parent's state, potentially changing which payslip
  // `findLatestPayslip` would now return).
  const [target] = useState(() => findLatestPayslip(taxYear))

  const [ytdGross, setYtdGross] = useState(target ? String(target.payslip.ytdGross) : '')
  const [ytdTaxPaid, setYtdTaxPaid] = useState(target ? String(target.payslip.ytdTaxPaid) : '')
  const [ytdEmployeeNI, setYtdEmployeeNI] = useState(target ? String(target.payslip.ytdEmployeeNI) : '')
  const [basicSalary, setBasicSalary] = useState(target ? String(target.payslip.basicSalary) : '')
  const [taxPaid, setTaxPaid] = useState(target ? String(target.payslip.taxPaid) : '')
  const [employeeNI, setEmployeeNI] = useState(target ? String(target.payslip.employeeNI) : '')
  const [taxCode, setTaxCode] = useState(target ? target.payslip.taxCode : '')
  const [taxPeriod, setTaxPeriod] = useState(target ? String(target.payslip.taxPeriod) : '')
  const [state, setState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  if (!target) {
    return (
      <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
        <h2 className="font-serif text-base mb-2">Payslip figures</h2>
        <p className="text-text-2 text-sm">
          No payslip has been saved yet, so there's nothing to correct here. Upload one on the{' '}
          <Link to="/documents" className="text-accent underline decoration-dashed">Documents</Link> screen first.
        </p>
      </div>
    )
  }

  const handleSave = async () => {
    const parsedYtdGross = parseMoney(ytdGross)
    const parsedYtdTaxPaid = parseMoney(ytdTaxPaid)
    const parsedYtdEmployeeNI = parseMoney(ytdEmployeeNI)
    const parsedBasicSalary = parseMoney(basicSalary)
    const parsedTaxPaid = parseMoney(taxPaid)
    const parsedEmployeeNI = parseMoney(employeeNI)

    if (
      parsedYtdGross === null ||
      parsedYtdTaxPaid === null ||
      parsedYtdEmployeeNI === null ||
      parsedBasicSalary === null ||
      parsedTaxPaid === null ||
      parsedEmployeeNI === null
    ) {
      setErrorMessage("Check the figures — one of them isn't a valid number.")
      setState('error')
      return
    }

    setState('saving')
    const period = Math.round(Math.min(12, Math.max(1, Number(taxPeriod) || target.payslip.taxPeriod)))
    const updated = applyPayslipEdits(taxYear, target.employmentId, target.payslip.id, {
      ytdGross: parsedYtdGross,
      ytdTaxPaid: parsedYtdTaxPaid,
      ytdEmployeeNI: parsedYtdEmployeeNI,
      basicSalary: parsedBasicSalary,
      taxPaid: parsedTaxPaid,
      employeeNI: parsedEmployeeNI,
      taxCode,
      taxPeriod: period,
    })

    try {
      await onSave(updated)
      setState('saved')
    } catch {
      setErrorMessage("Couldn't save — check your connection and try again.")
      setState('error')
    }
  }

  const onlyDigits = (value: string) => value.replace(/[^0-9.]/g, '')

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h2 className="font-serif text-base mb-1">Payslip figures</h2>
      <p className="text-text-2 text-xs mb-4">
        Correcting figures here for {target.payslip.employerName}, period {target.payslip.taxPeriod}. These drive
        the Dashboard, Income and the year-end projection, so fix anything the AI extraction got wrong.
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tax period</label>
            <input
              type="number"
              min={1}
              max={12}
              inputMode="numeric"
              className={numericInputClass}
              value={taxPeriod}
              onChange={e => setTaxPeriod(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Tax code</label>
            <input
              className={numericInputClass}
              value={taxCode}
              onChange={e => setTaxCode(e.target.value)}
              placeholder="1257L"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Basic salary (this period)</label>
          <input
            inputMode="numeric"
            className={numericInputClass}
            value={basicSalary}
            onChange={e => setBasicSalary(onlyDigits(e.target.value))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tax paid (this period)</label>
            <input
              inputMode="numeric"
              className={numericInputClass}
              value={taxPaid}
              onChange={e => setTaxPaid(onlyDigits(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Employee NI (this period)</label>
            <input
              inputMode="numeric"
              className={numericInputClass}
              value={employeeNI}
              onChange={e => setEmployeeNI(onlyDigits(e.target.value))}
            />
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.06]">
          <p className="text-[11px] uppercase tracking-[.06em] text-text-2 mb-3">
            <JargonTip term="Year to date" explanation="The running total of a figure from the start of the tax year (6 April) up to this payslip's date — not just this period's amount." /> figures
          </p>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>YTD gross pay</label>
              <input
                inputMode="numeric"
                className={numericInputClass}
                value={ytdGross}
                onChange={e => setYtdGross(onlyDigits(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>YTD tax paid</label>
                <input
                  inputMode="numeric"
                  className={numericInputClass}
                  value={ytdTaxPaid}
                  onChange={e => setYtdTaxPaid(onlyDigits(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>YTD employee NI</label>
                <input
                  inputMode="numeric"
                  className={numericInputClass}
                  value={ytdEmployeeNI}
                  onChange={e => setYtdEmployeeNI(onlyDigits(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-5">
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
