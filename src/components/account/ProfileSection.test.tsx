import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { ProfileSection } from './ProfileSection'
import type { Profile } from '../../types'

const profile: Profile = {
  id: 'mike',
  firstName: 'Mike',
  niNumber: 'AB123456C',
  taxCode: '1257L',
  pinHash: 'hash',
  pinSalt: 'salt',
  githubPat: '',
  schemes: [],
  otherIncomeSources: [],
  baseAnnualSalary: 60000,
}

const onSave = vi.fn((_updated: Profile) => Promise.resolve())

const salaryInput = () => screen.getByPlaceholderText('60000')
const saveButton = () => screen.getByRole('button', { name: /save/i })

describe('ProfileSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a salary that is not a valid number instead of silently dropping it', async () => {
    render(<ProfileSection profile={profile} onSave={onSave} />)

    fireEvent.change(salaryInput(), { target: { value: '1.2.3' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText(/check the salary/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a valid salary as a number', async () => {
    render(<ProfileSection profile={profile} onSave={onSave} />)

    fireEvent.change(salaryInput(), { target: { value: '63000' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText(/saved/i)).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ baseAnnualSalary: 63000 })
  })

  it('keeps a blank salary meaning "not stated" — the field is removed, not zeroed', async () => {
    render(<ProfileSection profile={profile} onSave={onSave} />)

    fireEvent.change(salaryInput(), { target: { value: '' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText(/saved/i)).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('baseAnnualSalary')
  })

  it('clears a stale "Saved" tick as soon as a field is edited', async () => {
    render(<ProfileSection profile={profile} onSave={onSave} />)

    fireEvent.click(saveButton())
    expect(await screen.findByText(/saved/i)).toBeInTheDocument()

    fireEvent.change(salaryInput(), { target: { value: '70000' } })
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument()
  })
})
