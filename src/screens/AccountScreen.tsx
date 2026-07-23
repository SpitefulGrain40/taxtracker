import { ProfileSection } from '../components/account/ProfileSection'
import { PayslipSection } from '../components/account/PayslipSection'
import { FutureEventsSection } from '../components/account/FutureEventsSection'
import { SchemesSection } from '../components/account/SchemesSection'
import { useProfile } from '../hooks/useProfile'
import { useTaxYear } from '../hooks/useTaxYear'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { storage } from '../lib/storage'
import { getCurrentTaxYear } from '../lib/taxYears'

export function AccountScreen() {
  const profileId = storage.getActiveProfile()
  const { profile, loading, saveProfile } = useProfile(profileId)
  const { taxYear, loading: taxYearLoading, saveTaxYear } = useTaxYear(profileId)
  const { events, loading: eventsLoading, saveEvents } = useFutureEvents(profileId)

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
        <div className="space-y-5">
          <ProfileSection profile={profile} onSave={saveProfile} />
          {!taxYearLoading && taxYear && (
            <PayslipSection taxYear={taxYear} onSave={saveTaxYear} />
          )}
          {!eventsLoading && (
            <FutureEventsSection events={events} taxYearKey={getCurrentTaxYear()} onSave={saveEvents} />
          )}
          <SchemesSection profile={profile} onSave={saveProfile} />
        </div>
      )}
    </div>
  )
}
