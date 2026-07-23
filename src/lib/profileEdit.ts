import type { Profile } from '../types'

export interface ProfileEditForm {
  firstName: string
  niNumber: string
  taxCode: string
  /** null when the user left the field empty — the field is then removed entirely. */
  baseAnnualSalary: number | null
}

/**
 * Merge edited fields into an existing Profile.
 *
 * Spreads the original so untouched fields (pinHash, pinSalt, githubPat, schemes,
 * otherIncomeSources) always survive — losing the PIN hash/salt would lock the
 * user out. A null salary REMOVES baseAnnualSalary rather than storing 0, because
 * projection.ts treats a stated salary as authoritative and 0 would project no
 * future income.
 */
export function buildUpdatedProfile(profile: Profile, form: ProfileEditForm): Profile {
  const updated: Profile = {
    ...profile,
    firstName: form.firstName,
    niNumber: form.niNumber,
    taxCode: form.taxCode,
  }
  if (form.baseAnnualSalary != null) {
    updated.baseAnnualSalary = form.baseAnnualSalary
  } else {
    delete updated.baseAnnualSalary
  }
  return updated
}
