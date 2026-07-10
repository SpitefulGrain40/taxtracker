import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Earned this year" value="£26,377" />)
    expect(screen.getByText('Earned this year')).toBeInTheDocument()
    expect(screen.getByText('£26,377')).toBeInTheDocument()
  })

  it('renders optional note', () => {
    render(<StatCard label="Tax paid" value="£8,457" note="via PAYE" />)
    expect(screen.getByText('via PAYE')).toBeInTheDocument()
  })

  it('applies green colour variant', () => {
    render(<StatCard label="Tax paid" value="£8,457" variant="green" />)
    const value = screen.getByText('£8,457')
    expect(value.className).toContain('text-green')
  })
})
