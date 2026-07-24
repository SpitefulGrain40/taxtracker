import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { AddLotForm } from './AddLotForm'
import type { ShareLot, ShareSchemeConfig } from '../../types'

function makeScheme(overrides: Partial<ShareSchemeConfig> = {}): ShareSchemeConfig {
  return {
    id: 'scheme-1',
    employerName: 'Acme Corp',
    schemeType: 'rsu',
    currency: 'GBP',
    exchange: 'LSE',
    broker: 'EquatePlus',
    active: true,
    ...overrides,
  }
}

function setup(schemes: ShareSchemeConfig[]) {
  const onAdd = vi.fn((_lot: ShareLot) => Promise.resolve())
  const view = render(<AddLotForm schemes={schemes} onAdd={onAdd} />)
  return {
    ...view,
    onAdd,
    dateInput: () => view.container.querySelector('input[type="date"]') as HTMLInputElement,
    quantityInput: () => screen.getByPlaceholderText('100'),
    priceInput: () => screen.getByPlaceholderText('0.00'),
    fxInput: () => screen.queryByPlaceholderText('1.00'),
    addButton: () => screen.getByRole('button', { name: /^add lot$/i }),
  }
}

describe('AddLotForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a blank quantity rather than calling onAdd', async () => {
    const ui = setup([makeScheme()])

    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.change(ui.priceInput(), { target: { value: '10' } })
    fireEvent.click(ui.addButton())

    expect(await screen.findByText(/quantity must be greater than 0/i)).toBeInTheDocument()
    expect(ui.onAdd).not.toHaveBeenCalled()
  })

  it('rejects non-numeric quantity text rather than calling onAdd', async () => {
    const ui = setup([makeScheme()])

    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.change(ui.quantityInput(), { target: { value: 'abc' } })
    fireEvent.change(ui.priceInput(), { target: { value: '10' } })
    fireEvent.click(ui.addButton())

    expect(await screen.findByText(/quantity must be a number/i)).toBeInTheDocument()
    expect(ui.onAdd).not.toHaveBeenCalled()
  })

  it('rejects a blank market price rather than calling onAdd', async () => {
    const ui = setup([makeScheme()])

    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.change(ui.quantityInput(), { target: { value: '10' } })
    fireEvent.click(ui.addButton())

    expect(await screen.findByText(/market price must be greater than 0/i)).toBeInTheDocument()
    expect(ui.onAdd).not.toHaveBeenCalled()
  })

  it('rejects non-numeric market price text rather than calling onAdd', async () => {
    const ui = setup([makeScheme()])

    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.change(ui.quantityInput(), { target: { value: '10' } })
    fireEvent.change(ui.priceInput(), { target: { value: 'xyz' } })
    fireEvent.click(ui.addButton())

    expect(await screen.findByText(/market price must be a number/i)).toBeInTheDocument()
    expect(ui.onAdd).not.toHaveBeenCalled()
  })

  it('blocks adding when an espp-discounted scheme is missing its discount rate', () => {
    const ui = setup([makeScheme({ schemeType: 'espp-discounted', currency: 'USD', discountRate: undefined })])

    expect(screen.getByText(/set the discount % for acme corp in account/i)).toBeInTheDocument()
    expect(ui.addButton()).toBeDisabled()

    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.change(ui.quantityInput(), { target: { value: '10' } })
    fireEvent.change(ui.priceInput(), { target: { value: '10' } })
    fireEvent.click(ui.addButton())

    expect(ui.onAdd).not.toHaveBeenCalled()
  })

  it('hides the FX field and treats fx as 1 for a GBP scheme', async () => {
    const ui = setup([makeScheme({ id: 'gbp-scheme', currency: 'GBP' })])

    expect(ui.fxInput()).not.toBeInTheDocument()

    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.change(ui.quantityInput(), { target: { value: '10' } })
    fireEvent.change(ui.priceInput(), { target: { value: '25' } })
    fireEvent.click(ui.addButton())

    await waitFor(() => expect(ui.onAdd).toHaveBeenCalledTimes(1))
    const lot = ui.onAdd.mock.calls[0][0]
    expect(lot.acquisitionPriceFX).toBe(1)
    expect(lot.costBasisGBP).toBe(10 * 25)
  })

  it('computes cost basis at full market value and taxable income as the discount for a discounted USD ESPP', async () => {
    const ui = setup([
      makeScheme({ id: 'us-espp', schemeType: 'espp-discounted', currency: 'USD', discountRate: 0.15 }),
    ])

    fireEvent.change(ui.dateInput(), { target: { value: '2025-09-01' } })
    fireEvent.change(ui.quantityInput(), { target: { value: '100' } })
    fireEvent.change(ui.priceInput(), { target: { value: '200' } })
    fireEvent.change(ui.fxInput() as HTMLElement, { target: { value: '0.79' } })
    fireEvent.click(ui.addButton())

    await waitFor(() => expect(ui.onAdd).toHaveBeenCalledTimes(1))
    const lot = ui.onAdd.mock.calls[0][0]
    // Cost basis is the full market value (not the discounted price paid).
    expect(lot.costBasisGBP).toBeCloseTo(15800, 5)
    // Taxable income is just the discount.
    expect(lot.taxableIncomeGBP).toBeCloseTo(2370, 5)
  })
})
