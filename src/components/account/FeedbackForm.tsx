import { useState } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'
import { getDataClient } from '../../lib/github'
import { appendFeedback } from '../../lib/dataRepo'
import { storage } from '../../lib/storage'
import type { FeedbackEntry } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  screen: string
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

export function FeedbackForm({ open, onClose, screen }: Props) {
  const [text, setText] = useState('')
  const [state, setState] = useState<SendState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!open) return null

  const handleClose = () => {
    setText('')
    setState('idle')
    setErrorMessage(null)
    onClose()
  }

  const handleSend = async () => {
    if (!text.trim() || state === 'sending') return
    setState('sending')
    setErrorMessage(null)

    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) {
      setErrorMessage('Feedback needs your data repo connected — check Setup.')
      setState('error')
      return
    }

    try {
      const client = getDataClient(pat, repo)
      const entry: FeedbackEntry = {
        id: crypto.randomUUID(),
        text: text.trim(),
        screen,
        profileId: storage.getActiveProfile(),
        appEnv: import.meta.env.MODE,
        createdAt: new Date().toISOString(),
      }
      await appendFeedback(client, entry)
      setState('sent')
      setText('')
    } catch {
      setErrorMessage("Couldn't send — check your connection and try again.")
      setState('error')
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-md bg-surface border border-white/[0.06] rounded-[10px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-base">Submit feedback</h2>
          <button onClick={handleClose} aria-label="Close" className="text-text-2 hover:text-text-1 transition-colors">
            <X size={18} />
          </button>
        </div>

        {state === 'sent' ? (
          <div>
            <div className="flex items-center gap-1.5 text-green text-sm py-4">
              <Check size={16} /> Thanks — sent
            </div>
            <button
              onClick={handleClose}
              className="bg-accent text-bg font-semibold py-2.5 px-5 rounded-lg text-sm hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <label className="block text-[11px] uppercase tracking-[.06em] text-text-2 mb-1.5">
              What's on your mind?
            </label>
            <textarea
              className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:border-accent/50 min-h-[120px] resize-none"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Bugs, ideas, anything that's not working…"
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSend}
                disabled={state === 'sending' || !text.trim()}
                className="bg-accent text-bg font-semibold py-2.5 px-5 rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {state === 'sending' ? 'Sending…' : 'Send'}
              </button>
              <button
                onClick={handleClose}
                className="text-text-2 text-sm hover:text-text-1 transition-colors"
              >
                Cancel
              </button>
              {state === 'error' && errorMessage && (
                <span className="flex items-center gap-1.5 text-red text-xs">
                  <TriangleAlert size={14} /> {errorMessage}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
