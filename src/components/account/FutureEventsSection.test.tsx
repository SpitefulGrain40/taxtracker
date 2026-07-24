import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { FutureEventsSection } from './FutureEventsSection'
import type { FutureIncomeEvent, TaxYearKey } from '../../types'

const TAX_YEAR = '2025-26' as TaxYearKey

const onSave = vi.fn((_events: FutureIncomeEvent[]) => Promise.resolve())

function setup() {
  const view = render(<FutureEventsSection events={[]} taxYearKey={TAX_YEAR} onSave={onSave} />)
  return {
    ...view,
    typeSelect: () => screen.getByRole('combobox'),
    labelInput: () => screen.getByPlaceholderText('e.g. Annual bonus'),
    dateInput: () => view.container.querySelector('input[type="date"]') as HTMLInputElement,
    addButton: () => screen.getByRole('button', { name: /^add$/i }),
  }
}

describe('FutureEventsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a pay rise with a blank amount rather than treating it as £0', () => {
    const ui = setup()

    fireEvent.change(ui.typeSelect(), { target: { value: 'pay-rise' } })
    fireEvent.change(ui.labelInput(), { target: { value: 'Annual review' } })
    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.click(ui.addButton())

    expect(screen.getByText(/can't be blank or zero/i)).toBeInTheDocument()
    expect(screen.queryByText('Annual review')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects an explicit zero amount too', () => {
    const ui = setup()

    fireEvent.change(ui.labelInput(), { target: { value: 'Zero bonus' } })
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '0' } })
    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.click(ui.addButton())

    expect(screen.getByText(/can't be blank or zero/i)).toBeInTheDocument()
    expect(screen.queryByText('Zero bonus')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects a date after the end of the tagged tax year', () => {
    const ui = setup()

    fireEvent.change(ui.labelInput(), { target: { value: 'Next year bonus' } })
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '5000' } })
    fireEvent.change(ui.dateInput(), { target: { value: '2026-06-01' } })
    fireEvent.click(ui.addButton())

    expect(screen.getByText(/must fall in the 2025–26 tax year/i)).toBeInTheDocument()
    expect(screen.queryByText('Next year bonus')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects a date before the start of the tagged tax year', () => {
    const ui = setup()

    fireEvent.change(ui.labelInput(), { target: { value: 'Last year bonus' } })
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '5000' } })
    fireEvent.change(ui.dateInput(), { target: { value: '2025-04-05' } })
    fireEvent.click(ui.addButton())

    expect(screen.getByText(/must fall in the 2025–26 tax year/i)).toBeInTheDocument()
    expect(screen.queryByText('Last year bonus')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('accepts a valid in-year event and saves it', async () => {
    const ui = setup()

    fireEvent.change(ui.labelInput(), { target: { value: 'Annual bonus' } })
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '5000' } })
    fireEvent.change(ui.dateInput(), { target: { value: '2025-12-01' } })
    fireEvent.click(ui.addButton())

    expect(screen.getByText('Annual bonus')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await screen.findByText(/^saved$/i)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject([
      { type: 'bonus', label: 'Annual bonus', amount: 5000, effectiveDate: '2025-12-01', taxYear: TAX_YEAR },
    ])
  })
})
