import { ProfileSection } from '../components/account/ProfileSection'
import { useProfile } from '../hooks/useProfile'
import { storage } from '../lib/storage'

export function AccountScreen() {
  const profileId = storage.getActiveProfile()
  const { profile, loading, saveProfile } = useProfile(profileId)

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Account</h1>
      </div>

      {loading && <div className="text-text-2 text-sm py-8">Loading your account…</div>}

      {!loading && !profile && (
        <div className="text-text-2 text-sm py-8">No profile saved yet — finish onboarding first.</div>
      )}

      {!loading && profile && (
        <ProfileSection profile={profile} onSave={saveProfile} />
      )}
    </div>
  )
}
