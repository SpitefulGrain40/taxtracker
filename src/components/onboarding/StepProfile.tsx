import { useState } from 'react'
import type { Profile, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  prefill?: { firstName?: string; niNumber?: string; taxCode?: string; employerName?: string }
  onNext: (data: Pick<Profile, 'firstName' | 'niNumber' | 'taxCode'> & { employerName: string }) => void
}

export function StepProfile({ profileId, prefill, onNext }: Props) {
  const [firstName, setFirstName] = useState(prefill?.firstName ?? (profileId === 'mike' ? 'Mike' : 'Gemma'))
  const [niNumber, setNiNumber] = useState(prefill?.niNumber ?? '')
  const [taxCode, setTaxCode] = useState(prefill?.taxCode ?? '')
  const [employerName, setEmployerName] = useState(prefill?.employerName ?? '')

  const fields = [
    { label: 'First name', value: firstName, onChange: setFirstName, placeholder: 'Mike', mono: false },
    { label: 'NI Number', value: niNumber, onChange: setNiNumber, placeholder: 'AB 12 34 56 C', mono: true },
    { label: 'Tax code', value: taxCode, onChange: setTaxCode, placeholder: '1257L', mono: true },
    { label: 'Employer name', value: employerName, onChange: setEmployerName, placeholder: 'SAP UK Ltd', mono: false },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Your details</h3>
        <p className="text-text-2 text-sm">We've pre-filled what we could from your payslip. Check and correct anything.</p>
      </div>
      {fields.map(f => (
        <div key={f.label}>
          <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">{f.label}</label>
          <input
            className={`w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:border-accent/50 ${f.mono ? 'font-mono' : ''}`}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            placeholder={f.placeholder}
          />
        </div>
      ))}
      <button
        onClick={() => onNext({ firstName, niNumber, taxCode, employerName })}
        disabled={!firstName || !employerName}
        className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        Continue
      </button>
    </div>
  )
}
