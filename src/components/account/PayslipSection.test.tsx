import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, beforeEach } from 'vitest'
import { PayslipSection } from './PayslipSection'
import type { Payslip, TaxYear } from '../../types'

function makePayslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    id: 'p1',
    taxPeriod: 3,
    taxYear: '2025-26',
    date: '2025-06-25',
    basicSalary: 5000,
    carAllowance: 0,
    otherPayments: [],
    taxPaid: 800,
    employeeNI: 300,
    salarySacrifice: [{ label: 'Pension', amount: 250 }],
    esppContribution: 150,
    employerMatch: 150,
    ytdGross: 15000,
    ytdTaxPaid: 2400,
    ytdEmployeeNI: 900,
    taxCode: '1257L',
    niNumber: 'AB123456C',
    employerName: 'SAP UK Ltd',
    rawExtracted: { grossPay: '5000.00', taxPeriod: '3' },
    ...overrides,
  }
}

function makeTaxYear(payslips: Payslip[]): TaxYear {
  return {
    key: '2025-26',
    startDate: '2025-04-06',
    endDate: '2026-04-05',
    employment: [{ id: 'emp1', employerName: 'SAP UK Ltd', payslips }],
    dividends: [],
    savingsInterest: [],
    benefitsInKind: [],
  }
}

const onSave = vi.fn((_ty: TaxYear) => Promise.resolve())

const saveButton = () => screen.getByRole('button', { name: /^save$/i })

describe('PayslipSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a numeric field that is not a valid number instead of silently dropping it', async () => {
    const taxYear = makeTaxYear([makePayslip()])
    render(<PayslipSection taxYear={taxYear} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '1.2.3' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText(/isn't a valid number/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a valid edit immutably, targeting the latest payslip and preserving rawExtracted', async () => {
    const payslip = makePayslip()
    const taxYear = makeTaxYear([payslip])
    const snapshot: TaxYear = JSON.parse(JSON.stringify(taxYear))

    render(<PayslipSection taxYear={taxYear} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '5500' } })
    fireEvent.click(saveButton())

    await screen.findByText(/^saved$/i)
    expect(onSave).toHaveBeenCalledTimes(1)

    const updated = onSave.mock.calls[0][0] as TaxYear
    const updatedPayslip = updated.employment[0].payslips[0]
    expect(updatedPayslip.basicSalary).toBe(5500)
    expect(updatedPayslip.rawExtracted).toEqual(payslip.rawExtracted)
    expect(updatedPayslip.id).toBe(payslip.id)

    // The original object passed in must never be mutated.
    expect(taxYear).toEqual(snapshot)
  })

  it('rejects an out-of-range tax period rather than clamping it', async () => {
    const taxYear = makeTaxYear([makePayslip()])
    render(<PayslipSection taxYear={taxYear} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '13' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText(/check the tax period/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects a non-integer tax period', async () => {
    const taxYear = makeTaxYear([makePayslip()])
    render(<PayslipSection taxYear={taxYear} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '3.5' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText(/check the tax period/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows the empty state pointing to Documents when there are no payslips', () => {
    const taxYear = makeTaxYear([])
    render(
      <MemoryRouter>
        <PayslipSection taxYear={taxYear} onSave={onSave} />
      </MemoryRouter>
    )

    expect(screen.getByText(/no payslip has been saved yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /documents/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument()
  })
})
