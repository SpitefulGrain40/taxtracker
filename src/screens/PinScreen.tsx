import { useState } from 'react'
import { Delete } from 'lucide-react'

interface Props {
  onUnlock: (pin: string) => void
  error: string | null
}

const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinScreen({ onUnlock, error }: Props) {
  const [pin, setPin] = useState('')

  const handleDigit = (d: string) => {
    if (d === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (!d) return
    const next = pin + d
    setPin(next)
    if (next.length >= 4) {
      onUnlock(next)
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Tax<span className="text-accent">Tracker</span></h1>
        <p className="text-text-2 text-sm mt-1">Enter your PIN to continue</p>
      </div>

      <div className="flex gap-3">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border transition-all ${
              pin.length > i ? 'bg-accent border-accent' : 'border-text-3'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red text-sm -mt-4">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3 w-64">
        {DIGITS.map((d, i) => (
          <button
            key={i}
            onClick={() => handleDigit(d)}
            disabled={!d && d !== '0'}
            className={`h-14 rounded-xl text-xl font-medium transition-all ${
              d === '⌫'
                ? 'text-text-2 hover:text-text-1'
                : d
                ? 'bg-surface border border-white/[0.06] text-text-1 hover:bg-surface-2 hover:border-white/10 active:scale-95'
                : 'invisible'
            }`}
          >
            {d === '⌫' ? <Delete size={20} className="mx-auto" /> : d}
          </button>
        ))}
      </div>
    </div>
  )
}
