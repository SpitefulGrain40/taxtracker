import { useState } from 'react'
import { Lock, Download, X } from 'lucide-react'
import { encryptJSON } from '../../lib/encryptedExport'

interface Props {
  data: unknown
  filename: string
  onClose: () => void
}

export function ExportDialog({ data, filename, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    if (password.length < 6) return
    setBusy(true)
    try {
      const blob = await encryptJSON(data, password)
      const json = JSON.stringify(blob, null, 2)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-surface border border-white/10 rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-accent" />
            <h3 className="font-serif text-lg">Export for accountant</h3>
          </div>
          <button onClick={onClose} className="text-text-2 hover:text-text-1"><X size={16} /></button>
        </div>
        <p className="text-text-2 text-sm mb-4">Your tax figures will be encrypted with a password. Share the file and password separately for safety.</p>
        <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">Password (min 6 chars)</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono mb-4 focus:outline-none focus:border-accent/50" />
        <button onClick={handleExport} disabled={password.length < 6 || busy}
          className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2">
          <Download size={14} />
          {busy ? 'Encrypting…' : 'Download encrypted file'}
        </button>
      </div>
    </div>
  )
}
