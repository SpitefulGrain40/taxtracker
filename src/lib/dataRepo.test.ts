import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readProfile, writeProfile, profilePath, taxYearPath } from './dataRepo'
import {
  futureEventsPath, readFutureEvents, writeFutureEvents, emptyFutureEvents, taxYearWithPayslip,
} from './dataRepo'
import type { Payslip } from '../types'

const mockClient = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
}

describe('path helpers', () => {
  it('profilePath returns correct path', () => {
    expect(profilePath('mike')).toBe('data/mike/profile.json')
    expect(profilePath('gemma')).toBe('data/gemma/profile.json')
  })

  it('taxYearPath returns correct path', () => {
    expect(taxYearPath('mike', '2025-26')).toBe('data/mike/2025-26.json')
  })
})

describe('readProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns profile data when file exists', async () => {
    const profile = { id: 'mike' as const, firstName: 'Mike', niNumber: 'JL041798C', taxCode: '207T', pinHash: 'h', pinSalt: 's', githubPat: '', schemes: [], otherIncomeSources: [] as [] }
    mockClient.readFile.mockResolvedValue({ data: profile, sha: 'abc' })
    const result = await readProfile(mockClient as never, 'mike')
    expect(result?.data.firstName).toBe('Mike')
    expect(mockClient.readFile).toHaveBeenCalledWith('data/mike/profile.json')
  })

  it('returns null when profile does not exist', async () => {
    mockClient.readFile.mockResolvedValue(null)
    const result = await readProfile(mockClient as never, 'mike')
    expect(result).toBeNull()
  })
})

describe('writeProfile', () => {
  it('calls writeFile with correct path', async () => {
    mockClient.writeFile.mockResolvedValue(undefined)
    const profile = { id: 'mike' as const, firstName: 'Mike', niNumber: '', taxCode: '', pinHash: '', pinSalt: '', githubPat: '', schemes: [], otherIncomeSources: [] as [] }
    await writeProfile(mockClient as never, 'mike', profile, 'sha123')
    expect(mockClient.writeFile).toHaveBeenCalledWith('data/mike/profile.json', profile, 'sha123')
  })
})

const fePathClient = { readFile: vi.fn(), writeFile: vi.fn() }

describe('future events data repo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('futureEventsPath returns correct path', () => {
    expect(futureEventsPath('mike')).toBe('data/mike/future-events.json')
  })

  it('emptyFutureEvents returns an empty array', () => {
    expect(emptyFutureEvents()).toEqual([])
  })

  it('readFutureEvents reads the future-events file', async () => {
    fePathClient.readFile.mockResolvedValue({ data: [], sha: 'x' })
    const result = await readFutureEvents(fePathClient as never, 'mike')
    expect(fePathClient.readFile).toHaveBeenCalledWith('data/mike/future-events.json')
    expect(result?.data).toEqual([])
  })

  it('writeFutureEvents writes the future-events file', async () => {
    fePathClient.writeFile.mockResolvedValue(undefined)
    await writeFutureEvents(fePathClient as never, 'mike', [], 'sha1')
    expect(fePathClient.writeFile).toHaveBeenCalledWith('data/mike/future-events.json', [], 'sha1')
  })
})

describe('taxYearWithPayslip', () => {
  const payslip: Payslip = {
    id: 'p1', taxPeriod: 4, taxYear: '2025-26', date: '2025-07-31',
    basicSalary: 5000, carAllowance: 0, otherPayments: [], taxPaid: 900, employeeNI: 400,
    salarySacrifice: [], esppContribution: 0, employerMatch: 0,
    ytdGross: 20000, ytdTaxPaid: 3600, ytdEmployeeNI: 1600,
    taxCode: '1257L', niNumber: 'AB123456C', employerName: 'SAP UK Ltd', rawExtracted: {},
  }

  it('builds a TaxYear with one employment entry holding the payslip', () => {
    const ty = taxYearWithPayslip('2025-26', payslip)
    expect(ty.key).toBe('2025-26')
    expect(ty.employment).toHaveLength(1)
    expect(ty.employment[0].employerName).toBe('SAP UK Ltd')
    expect(ty.employment[0].payslips).toEqual([payslip])
  })
})

import { feedbackPath, readFeedback, appendFeedback } from './dataRepo'
import type { FeedbackEntry } from '../types'

const fbClient = { readFile: vi.fn(), writeFile: vi.fn() }

const entry: FeedbackEntry = {
  id: 'f1', text: 'The projected figure is confusing', screen: '/',
  profileId: 'mike', appEnv: 'production', createdAt: '2026-07-23T10:00:00.000Z',
}

describe('feedback data repo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('feedbackPath is a shared repo-root file', () => {
    expect(feedbackPath()).toBe('feedback.json')
  })

  it('readFeedback reads the feedback file', async () => {
    fbClient.readFile.mockResolvedValue({ data: [entry], sha: 'x' })
    const result = await readFeedback(fbClient as never)
    expect(fbClient.readFile).toHaveBeenCalledWith('feedback.json')
    expect(result?.data).toEqual([entry])
  })

  it('appendFeedback appends to existing entries and passes the sha', async () => {
    fbClient.readFile.mockResolvedValue({ data: [entry], sha: 'sha1' })
    fbClient.writeFile.mockResolvedValue(undefined)
    const second: FeedbackEntry = { ...entry, id: 'f2', text: 'second' }
    await appendFeedback(fbClient as never, second)
    expect(fbClient.writeFile).toHaveBeenCalledWith('feedback.json', [entry, second], 'sha1')
  })

  it('appendFeedback creates the file when none exists', async () => {
    fbClient.readFile.mockResolvedValue(null)
    fbClient.writeFile.mockResolvedValue(undefined)
    await appendFeedback(fbClient as never, entry)
    expect(fbClient.writeFile).toHaveBeenCalledWith('feedback.json', [entry], undefined)
  })
})
