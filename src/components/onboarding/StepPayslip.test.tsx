import { render, screen, fireEvent } from '@testing-library/react'
import { StepPayslip } from './StepPayslip'
import { vi } from 'vitest'

describe('StepPayslip', () => {
  it('shows upload prompt initially', () => {
    render(<StepPayslip onExtracted={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByText(/Upload your most recent payslip/i)).toBeInTheDocument()
  })

  it('shows skip button', () => {
    render(<StepPayslip onExtracted={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('calls onSkip when skip is clicked', () => {
    const onSkip = vi.fn()
    render(<StepPayslip onExtracted={vi.fn()} onSkip={onSkip} />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onSkip).toHaveBeenCalledOnce()
  })
})
