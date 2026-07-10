import { DesktopNav } from './DesktopNav'
import { MobileNav } from './MobileNav'
import { storage } from '../../lib/storage'

interface Props {
  children: React.ReactNode
  onProfileSwitch: () => void
}

export function AppShell({ children, onProfileSwitch }: Props) {
  const profileId = storage.getActiveProfile()
  const profileName = profileId === 'mike' ? 'Mike' : 'Gemma'

  return (
    <div className="min-h-screen bg-bg text-text-1 font-sans">
      <DesktopNav profileName={profileName} onProfileClick={onProfileSwitch} />
      <main className="max-w-[1080px] mx-auto px-4 md:px-8 pt-8 pb-32 md:pb-20">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
