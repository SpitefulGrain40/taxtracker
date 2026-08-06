import { useEffect } from 'react'
import { ClipboardCheck, UserCog, LineChart, MessageSquare, Lock, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (to: string) => void
  onSubmitFeedback: () => void
  onLock: () => void
}

export function MoreDrawer({ open, onClose, onNavigate, onSubmitFeedback, onLock }: Props) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const items = [
    { label: 'Tax Return', icon: ClipboardCheck, onClick: () => onNavigate('/return') },
    { label: 'Account & profile', icon: UserCog, onClick: () => onNavigate('/account') },
    { label: 'Price settings', icon: LineChart, onClick: () => onNavigate('/shares') },
    { label: 'Submit feedback', icon: MessageSquare, onClick: onSubmitFeedback },
    { label: 'Lock', icon: Lock, onClick: onLock },
  ]

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More menu"
        className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-surface border-l border-white/[0.06] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06]">
          <span className="font-serif text-base">More</span>
          <button onClick={onClose} aria-label="Close" className="text-text-2 hover:text-text-1 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-2">
          {items.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-text-1 hover:bg-surface-3 transition-colors text-left"
            >
              <Icon size={16} className="text-text-2 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
