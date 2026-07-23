import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../hooks/useTaxYear', () => ({
  useTaxYear: () => ({
    taxYear: { key: '2025-26', startDate: '2025-04-06', endDate: '2026-04-05', employment: [], dividends: [], savingsInterest: [], benefitsInKind: [] },
    loading: false, sha: null, error: null, saveTaxYear: () => {}, refetch: () => {},
  }),
}))
vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({ profile: null, loading: false, sha: null, error: null, saveProfile: () => {}, refetch: () => {} }),
}))

import { DashboardScreen } from './DashboardScreen'

// A configured user who skipped the payslip has an empty (but non-null) tax year.
// The Dashboard must show the "add your first payslip" prompt, not zeroed stats.
describe('DashboardScreen empty state', () => {
  it('prompts for a first payslip when the tax year has no payslips', () => {
    render(<MemoryRouter><DashboardScreen /></MemoryRouter>)
    expect(screen.getByText(/add your first payslip/i)).toBeInTheDocument()
  })
})
