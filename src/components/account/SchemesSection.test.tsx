import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { SchemesSection } from './SchemesSection'
import type { Profile } from '../../types'

const profile: Profile = {
  id: 'mike',
  firstName: 'Mike',
  niNumber: 'AB123456C',
  taxCode: '1257L',
  pinHash: 'hash-abc',
  pinSalt: 'salt-xyz',
  githubPat: '',
  schemes: [],
  otherIncomeSources: [],
}

const onSave = vi.fn((_p: Profile) => Promise.resolve())

const addSchemeButton = () => screen.getByRole('button', { name: /add scheme/i })
const saveButton = () => screen.getByRole('button', { name: /^save$/i })
const employerInput = () => screen.getByPlaceholderText('e.g. SAP UK Ltd')
const currencyInput = () => screen.getByPlaceholderText('EUR')
const schemeTypeSelect = () => screen.getByRole('combobox')
const discountInput = () => screen.getByPlaceholderText('15')

describe('SchemesSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a scheme with a blank currency instead of falling back to a default', async () => {
    render(<SchemesSection profile={profile} onSave={onSave} />)

    fireEvent.click(addSchemeButton())
    fireEvent.change(employerInput(), { target: { value: 'Test Corp' } })
    // currency left blank
    fireEvent.click(saveButton())

    expect(await screen.findByText(/needs a currency/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('only shows the discount-% field for espp-discounted schemes', () => {
    render(<SchemesSection profile={profile} onSave={onSave} />)

    fireEvent.click(addSchemeButton())

    fireEvent.change(schemeTypeSelect(), { target: { value: 'espp-match' } })
    expect(screen.queryByPlaceholderText('15')).not.toBeInTheDocument()

    fireEvent.change(schemeTypeSelect(), { target: { value: 'espp-discounted' } })
    expect(screen.getByPlaceholderText('15')).toBeInTheDocument()
  })

  it('stores a typed discount percentage as the equivalent fraction', async () => {
    render(<SchemesSection profile={profile} onSave={onSave} />)

    fireEvent.click(addSchemeButton())
    fireEvent.change(employerInput(), { target: { value: 'Test Corp' } })
    fireEvent.change(currencyInput(), { target: { value: 'usd' } })
    fireEvent.change(schemeTypeSelect(), { target: { value: 'espp-discounted' } })
    fireEvent.change(discountInput(), { target: { value: '15' } })
    fireEvent.click(saveButton())

    await screen.findByText(/^saved$/i)
    expect(onSave).toHaveBeenCalledTimes(1)

    const saved = onSave.mock.calls[0][0] as Profile
    const scheme = saved.schemes.find(s => s.employerName === 'Test Corp')
    expect(scheme).toBeDefined()
    expect(scheme?.discountRate).toBe(0.15)
    expect(scheme?.currency).toBe('USD')
  })

  it('saves the whole profile with the new schemes, preserving pinHash and pinSalt', async () => {
    render(<SchemesSection profile={profile} onSave={onSave} />)

    fireEvent.click(addSchemeButton())
    fireEvent.change(employerInput(), { target: { value: 'Test Corp' } })
    fireEvent.change(currencyInput(), { target: { value: 'eur' } })
    fireEvent.click(saveButton())

    await screen.findByText(/^saved$/i)
    expect(onSave).toHaveBeenCalledTimes(1)

    const saved = onSave.mock.calls[0][0] as Profile
    expect(saved).toEqual({
      ...profile,
      schemes: saved.schemes,
    })
    expect(saved.pinHash).toBe(profile.pinHash)
    expect(saved.pinSalt).toBe(profile.pinSalt)
    expect(saved.schemes).toHaveLength(1)
    expect(saved.schemes[0]).toMatchObject({ employerName: 'Test Corp', currency: 'EUR' })
  })
})
