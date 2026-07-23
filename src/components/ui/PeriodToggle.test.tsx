import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { PeriodToggle } from './PeriodToggle'

describe('PeriodToggle', () => {
  it('renders the three period options and marks the active one', () => {
    render(<PeriodToggle value="ytd" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /this month/i })).toBeInTheDocument()
    const ytd = screen.getByRole('button', { name: /year to date/i })
    expect(ytd).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /projected/i })).toBeInTheDocument()
  })

  it('calls onChange with the selected period', () => {
    const onChange = vi.fn()
    render(<PeriodToggle value="ytd" onChange={onChange} />)
    screen.getByRole('button', { name: /projected/i }).click()
    expect(onChange).toHaveBeenCalledWith('projected')
  })
})
