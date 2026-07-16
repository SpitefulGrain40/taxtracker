import type { GitHubDataClient } from './github'
import type { Profile, TaxYear, ShareLot, LifeEvent, ProfileId, TaxYearKey } from '../types'

// ─── Path helpers ─────────────────────────────────────────────────────────────

export const profilePath = (profileId: ProfileId | string) => `data/${profileId}/profile.json`
export const taxYearPath = (profileId: ProfileId | string, year: TaxYearKey) => `data/${profileId}/${year}.json`
export const shareLotsPath = (profileId: ProfileId | string) => `data/${profileId}/share-lots.json`
export const lifeEventsPath = (profileId: ProfileId | string) => `data/${profileId}/life-events.json`

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function readProfile(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<Profile>(profilePath(profileId))
}

export async function writeProfile(client: GitHubDataClient, profileId: ProfileId | string, profile: Profile, sha?: string) {
  return client.writeFile(profilePath(profileId), profile, sha)
}

// ─── Tax year ─────────────────────────────────────────────────────────────────

export function emptyTaxYear(key: TaxYearKey): TaxYear {
  const [startYear] = key.split('-')
  return {
    key,
    startDate: `${startYear}-04-06`,
    endDate: `${parseInt(startYear) + 1}-04-05`,
    employment: [],
    dividends: [],
    savingsInterest: [],
    benefitsInKind: [],
  }
}

export async function readTaxYear(client: GitHubDataClient, profileId: ProfileId | string, year: TaxYearKey) {
  return client.readFile<TaxYear>(taxYearPath(profileId, year))
}

export async function writeTaxYear(client: GitHubDataClient, profileId: ProfileId | string, year: TaxYearKey, data: TaxYear, sha?: string) {
  return client.writeFile(taxYearPath(profileId, year), data, sha)
}

// ─── Share lots ───────────────────────────────────────────────────────────────

export async function readShareLots(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<ShareLot[]>(shareLotsPath(profileId))
}

export async function writeShareLots(client: GitHubDataClient, profileId: ProfileId | string, lots: ShareLot[], sha?: string) {
  return client.writeFile(shareLotsPath(profileId), lots, sha)
}

// ─── Life events ──────────────────────────────────────────────────────────────

export async function readLifeEvents(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<LifeEvent[]>(lifeEventsPath(profileId))
}

export async function writeLifeEvents(client: GitHubDataClient, profileId: ProfileId | string, events: LifeEvent[], sha?: string) {
  return client.writeFile(lifeEventsPath(profileId), events, sha)
}
