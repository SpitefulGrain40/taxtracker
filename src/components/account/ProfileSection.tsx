import { useState } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { JargonTip } from '../ui/JargonTip'
import type { Profile } from '../../types'

interface Props {
  profile: Profile
  onSave: (p: Profile) => Promise<void>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function ProfileSection({ profile, onSave }: Props) {
  const [firstName, setFirstName] = useState(profile.firstName)
  const [niNumber, setNiNumber] = useState(profile.niNumber)
  const [taxCode, setTaxCode] = useState(profile.taxCode)
  const [baseAnnualSalary, setBaseAnnualSalary] = useState(
    profile.baseAnnualSalary != null ? String(profile.baseAnnualSalary) : ''
  )
  const [state, setState] = useState<SaveState>('idle')

  const handleSave = async () => {
    setState('saving')
    const salary = baseAnnualSalary ? Number(baseAnnualSalary) : null
    const updated: Profile = {
      ...profile,
      firstName,
      niNumber,
      taxCode,
      ...(salary != null && !Number.isNaN(salary) ? { baseAnnualSalary: salary } : {}),
    }
    if (salary == null) delete updated.baseAnnualSalary

    try {
      await onSave(updated)
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
      <h2 className="font-serif text-base mb-4">Your details</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">First name</label>
          <input
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:border-accent/50"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">
            <JargonTip term="NI number" explanation="Your National Insurance number — a unique reference HMRC uses to track your tax and NI contributions. Format: two letters, six digits, one letter (e.g. AB 12 34 56 C)." />
          </label>
          <input
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
            value={niNumber}
            onChange={e => setNiNumber(e.target.value)}
            placeholder="AB 12 34 56 C"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">
            <JargonTip term="Tax code" explanation="Tells your employer how much tax-free pay you get before deducting tax. Most codes end in a letter (e.g. 1257L). Codes starting with K mean you have deductions that outweigh your allowance, so extra tax is added rather than an allowance subtracted." />
          </label>
          <input
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
            value={taxCode}
            onChange={e => setTaxCode(e.target.value)}
            placeholder="1257L"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Annual base salary</label>
          <input
            inputMode="numeric"
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
            value={baseAnnualSalary}
            onChange={e => setBaseAnnualSalary(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="60000"
          />
          <p className="text-text-2 text-xs mt-1.5">Used to project your income for the rest of the tax year. Leave blank if unknown.</p>
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
            <TriangleAlert size={14} /> Couldn't save — check your connection and try again.
          </span>
        )}
      </div>
    </div>
  )
}
