import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { hashPin } from '../lib/auth'
import { storage } from '../lib/storage'

interface Props {
  onComplete: () => void
}

export function SetupScreen({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [pat, setPat] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [dataRepo, setDataRepo] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError] = useState('')

  const handleComplete = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== pinConfirm) { setError('PINs do not match'); return }
    const { hash, salt } = await hashPin(pin)
    storage.setGithubPat(pat)
    storage.setClaudeKey(claudeKey)
    storage.setPinHash('mike', hash, salt)
    localStorage.setItem('tt_data_repo', dataRepo)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-[28px] tracking-[-0.03em] mb-1">
          Tax<span className="text-accent">Tracker</span>
        </h1>
        <p className="text-text-2 text-sm mb-8">One-time setup — takes about 5 minutes</p>

        <div className="flex gap-2 mb-8">
          {[1,2,3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-accent' : 'bg-surface-3'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-serif text-xl">Connect your data storage</h2>
            <p className="text-text-2 text-sm">Your tax data is stored in a private GitHub repo that only you can access.</p>
            <div>
              <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-2">Private data repo (owner/name)</label>
              <input
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
                placeholder="yourusername/taxtracker-data"
                value={dataRepo}
                onChange={e => setDataRepo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-2">
                GitHub Personal Access Token
                <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noreferrer"
                  className="ml-2 text-accent inline-flex items-center gap-0.5 normal-case tracking-normal">
                  Create one <ExternalLink size={10} />
                </a>
              </label>
              <input
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
                placeholder="ghp_..."
                type="password"
                value={pat}
                onChange={e => setPat(e.target.value)}
              />
              <p className="text-[11px] text-text-2 mt-1.5">Scope needed: <span className="font-mono">repo</span> (full repository access)</p>
            </div>
            <button onClick={() => setStep(2)} disabled={!pat || !dataRepo}
              className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-serif text-xl">Connect AI document reading</h2>
            <p className="text-text-2 text-sm">TaxTracker uses Claude AI to read your payslips and tax documents automatically.</p>
            <div>
              <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-2">
                Claude API key
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
                  className="ml-2 text-accent inline-flex items-center gap-0.5 normal-case tracking-normal">
                  Get one <ExternalLink size={10} />
                </a>
              </label>
              <input
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50"
                placeholder="sk-ant-..."
                type="password"
                value={claudeKey}
                onChange={e => setClaudeKey(e.target.value)}
              />
            </div>
            <button onClick={() => setStep(3)} disabled={!claudeKey}
              className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity">
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-serif text-xl">Set your PIN</h2>
            <p className="text-text-2 text-sm">You'll enter this every time you open TaxTracker.</p>
            <div>
              <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-2">PIN (4–6 digits)</label>
              <input
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50 tracking-[0.4em]"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-2">Confirm PIN</label>
              <input
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 font-mono focus:outline-none focus:border-accent/50 tracking-[0.4em]"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirm}
                onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {error && <p className="text-red text-sm">{error}</p>}
            <button onClick={handleComplete} disabled={!pin || !pinConfirm}
              className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity">
              Finish setup
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
