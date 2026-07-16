import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readProfile, writeProfile, readTaxYear, writeTaxYear, profilePath, taxYearPath } from './dataRepo'

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
    const profile = { id: 'mike', firstName: 'Mike', niNumber: 'JL041798C', taxCode: '207T', pinHash: 'h', pinSalt: 's', schemes: [], otherIncomeSources: [] }
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
    const profile = { id: 'mike' as const, firstName: 'Mike', niNumber: '', taxCode: '', pinHash: '', pinSalt: '', schemes: [], otherIncomeSources: [] }
    await writeProfile(mockClient as never, 'mike', profile, 'sha123')
    expect(mockClient.writeFile).toHaveBeenCalledWith('data/mike/profile.json', profile, 'sha123')
  })
})
