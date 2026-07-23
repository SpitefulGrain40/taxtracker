import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DesktopNav } from './DesktopNav'
import { MobileNav } from './MobileNav'
import { MoreDrawer } from './MoreDrawer'
import { FeedbackForm } from '../account/FeedbackForm'
import { storage } from '../../lib/storage'

interface Props {
  children: React.ReactNode
  onProfileSwitch: () => void
  onLock: () => void
}

export function AppShell({ children, onProfileSwitch, onLock }: Props) {
  const profileId = storage.getActiveProfile()
  const profileName = profileId === 'mike' ? 'Mike' : 'Gemma'
  const [moreOpen, setMoreOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleNavigate = (to: string) => {
    navigate(to)
    setMoreOpen(false)
  }

  return (
    <div className="min-h-screen bg-bg text-text-1 font-sans">
      <DesktopNav profileName={profileName} onProfileClick={onProfileSwitch} onMoreClick={() => setMoreOpen(true)} />
      <main className="max-w-[1080px] mx-auto px-4 md:px-8 pt-8 pb-32 md:pb-20">
        {children}
      </main>
      <MobileNav onMoreClick={() => setMoreOpen(true)} />
      <MoreDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onNavigate={handleNavigate}
        onSubmitFeedback={() => { setMoreOpen(false); setFeedbackOpen(true) }}
        onSwitchProfile={onProfileSwitch}
        onLock={onLock}
        profileName={profileName}
      />
      <FeedbackForm open={feedbackOpen} onClose={() => setFeedbackOpen(false)} screen={pathname} />
    </div>
  )
}
