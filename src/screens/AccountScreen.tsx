import { useRef } from 'react'
import { ProfileSection } from '../components/account/ProfileSection'
import { PayslipSection } from '../components/account/PayslipSection'
import { FutureEventsSection } from '../components/account/FutureEventsSection'
import { SchemesSection } from '../components/account/SchemesSection'
import { useProfile } from '../hooks/useProfile'
import { useTaxYear } from '../hooks/useTaxYear'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { useSelectedTaxYear } from '../hooks/useSelectedTaxYear'
import { storage } from '../lib/storage'
import { getTaxYearLabel } from '../lib/taxYears'

export function AccountScreen() {
  const profileId = storage.getActiveProfile()
  const { year } = useSelectedTaxYear()
  const { profile, loading, error, saveProfile } = useProfile(profileId)
  const { taxYear, error: taxYearError, saveTaxYear } = useTaxYear(profileId, year)
  const { events, loading: eventsLoading, error: eventsError, saveEvents } = useFutureEvents(profileId)

  // Gate the sections on the FIRST load only, never on a refetch. Saves now store
  // the new sha directly (no post-save refetch), but a manual refetch() still
  // flips the hooks' `loading` back to true; unmounting the sections at that point
  // would throw away unsaved edits held in the other sections' local state (typed
  // payslip corrections, added future-income events) and would also hide the green
  // "Saved" confirmation. Once data has arrived the sections stay mounted through
  // any later refetch.
  //
  // `events` defaults to [] so it can't itself signal "loaded"; latch it once
  // instead. `taxYear` and `profile` are null until loaded, so they gate directly.
  const eventsEverLoaded = useRef(false)
  if (!eventsLoading && !eventsError) eventsEverLoaded.current = true

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Account</h1>
      </div>

      {loading && !profile && <div className="text-text-2 text-sm py-8">Loading your account…</div>}

      {!loading && !profile && error && (
        <div className="text-red text-sm py-8">
          Couldn't load your account — check your connection and data-repo settings.
        </div>
      )}

      {!loading && !error && !profile && (
        <div className="text-text-2 text-sm py-8">No profile saved yet — finish onboarding first.</div>
      )}

      {profile && (
        <div className="space-y-5">
          <ProfileSection profile={profile} onSave={saveProfile} />

          {taxYear && (
            <div>
              <p className="font-mono text-xs text-text-2 mb-2">Editing {getTaxYearLabel(year)}</p>
              <PayslipSection taxYear={taxYear} onSave={saveTaxYear} />
            </div>
          )}
          {!taxYear && taxYearError && (
            <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5 text-red text-sm">
              Couldn't load your payslip figures — check your connection and data-repo settings.
            </div>
          )}

          {eventsEverLoaded.current && (
            <FutureEventsSection events={events} taxYearKey={year} onSave={saveEvents} />
          )}
          {!eventsEverLoaded.current && eventsError && (
            <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5 text-red text-sm">
              Couldn't load your future income — check your connection and data-repo settings.
            </div>
          )}

          <SchemesSection profile={profile} onSave={saveProfile} />
        </div>
      )}
    </div>
  )
}
