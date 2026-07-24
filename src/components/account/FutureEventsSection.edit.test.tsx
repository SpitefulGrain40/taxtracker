import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { FutureEventsSection } from './FutureEventsSection'
import type { FutureIncomeEvent, TaxYearKey } from '../../types'

const TAX_YEAR = '2025-26' as TaxYearKey

const onSave = vi.fn((_events: FutureIncomeEvent[]) => Promise.resolve())

function existingEvent(overrides: Partial<FutureIncomeEvent> = {}): FutureIncomeEvent {
  return {
    id: 'e1',
    type: 'bonus',
    label: 'Existing bonus',
    amount: 1000,
    effectiveDate: '2025-12-01',
    taxYear: TAX_YEAR,
    subjectToNI: true,
    ...overrides,
  }
}

const editButton = (label: string) => screen.getByRole('button', { name: new RegExp(`^edit ${label}$`, 'i') })
const amountInput = () => screen.getByPlaceholderText('5000')
const saveChangesButton = () => screen.getByRole('button', { name: /^save changes$/i })
const saveButton = () => screen.getByRole('button', { name: /^save$/i })

describe('FutureEventsSection edit-in-place', () => {
  beforeEach(() => vi.clearAllMocks())

  it('edits an existing event in place, keeping its id and tax year and not duplicating it', async () => {
    const events = [existingEvent()]
    render(<FutureEventsSection events={events} taxYearKey={TAX_YEAR} onSave={onSave} />)

    fireEvent.click(editButton('Existing bonus'))
    fireEvent.change(amountInput(), { target: { value: '2500' } })
    fireEvent.click(saveChangesButton())

    // No duplicate row, and the amount is now reflected in the single row shown.
    expect(screen.getAllByText('Existing bonus')).toHaveLength(1)
    expect(screen.getByText('£2,500')).toBeInTheDocument()

    fireEvent.click(saveButton())

    await screen.findByText(/^saved$/i)
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0]
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ id: 'e1', taxYear: TAX_YEAR, amount: 2500, label: 'Existing bonus' })
  })

  it('rejects editing an event down to a blank amount, re-running validation', () => {
    const events = [existingEvent()]
    render(<FutureEventsSection events={events} taxYearKey={TAX_YEAR} onSave={onSave} />)

    fireEvent.click(editButton('Existing bonus'))
    fireEvent.change(amountInput(), { target: { value: '' } })
    fireEvent.click(saveChangesButton())

    expect(screen.getByText(/can't be blank or zero/i)).toBeInTheDocument()
    // The original event is untouched.
    expect(screen.getByText('£1,000')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})
