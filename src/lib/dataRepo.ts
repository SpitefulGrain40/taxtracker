import type { GitHubDataClient } from './github'
import type { Profile, TaxYear, ShareLot, LifeEvent, ProfileId, TaxYearKey, Payslip, FutureIncomeEvent } from '../types'

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

// ─── Future income events ─────────────────────────────────────────────────────

export const futureEventsPath = (profileId: ProfileId | string) => `data/${profileId}/future-events.json`

export function emptyFutureEvents(): FutureIncomeEvent[] {
  return []
}

export async function readFutureEvents(client: GitHubDataClient, profileId: ProfileId | string) {
  return client.readFile<FutureIncomeEvent[]>(futureEventsPath(profileId))
}

export async function writeFutureEvents(client: GitHubDataClient, profileId: ProfileId | string, events: FutureIncomeEvent[], sha?: string) {
  return client.writeFile(futureEventsPath(profileId), events, sha)
}

// ─── Tax year from a single payslip ───────────────────────────────────────────

export function taxYearWithPayslip(key: TaxYearKey, payslip: Payslip): TaxYear {
  const base = emptyTaxYear(key)
  return {
    ...base,
    employment: [{
      id: `emp-${payslip.employerName.toLowerCase().replace(/\s+/g, '-')}`,
      employerName: payslip.employerName,
      payslips: [payslip],
    }],
  }
}
