import { describe, it, expect } from 'vitest'
import { buildUpdatedProfile } from './profileEdit'
import type { Profile } from '../types'

const profile: Profile = {
  id: 'mike', firstName: 'Mike', niNumber: 'AB123456C', taxCode: '1257L',
  pinHash: 'hash', pinSalt: 'salt', githubPat: '',
  schemes: [{ id: 's1', employerName: 'SAP UK Ltd', schemeType: 'espp-match', currency: 'EUR', exchange: 'XETRA', broker: 'EquatePlus', active: true }],
  otherIncomeSources: ['dividends'],
  baseAnnualSalary: 60000,
}

const form = { firstName: 'Michael', niNumber: 'AB123456C', taxCode: 'K289', baseAnnualSalary: 72000 }

describe('buildUpdatedProfile', () => {
  it('applies the edited fields', () => {
    const out = buildUpdatedProfile(profile, form)
    expect(out.firstName).toBe('Michael')
    expect(out.taxCode).toBe('K289')
    expect(out.baseAnnualSalary).toBe(72000)
  })

  it('preserves fields the form never touches', () => {
    const out = buildUpdatedProfile(profile, form)
    expect(out.pinHash).toBe('hash')
    expect(out.pinSalt).toBe('salt')
    expect(out.schemes).toEqual(profile.schemes)
    expect(out.otherIncomeSources).toEqual(['dividends'])
    expect(out.id).toBe('mike')
  })

  it('removes a previously-saved salary when the field is cleared', () => {
    const out = buildUpdatedProfile(profile, { ...form, baseAnnualSalary: null })
    expect('baseAnnualSalary' in out).toBe(false)
  })

  it('never stores 0 for an empty salary', () => {
    const out = buildUpdatedProfile(profile, { ...form, baseAnnualSalary: null })
    expect(out.baseAnnualSalary).toBeUndefined()
  })

  it('does not mutate the original profile', () => {
    buildUpdatedProfile(profile, { ...form, baseAnnualSalary: null })
    expect(profile.baseAnnualSalary).toBe(60000)
  })
})
