import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JargonTip } from './JargonTip'

describe('JargonTip', () => {
  it('renders the term text', () => {
    render(<JargonTip term="PAYE" explanation="Pay As You Earn — your employer deducts tax automatically." />)
    expect(screen.getByText('PAYE')).toBeInTheDocument()
  })

  it('shows explanation on hover', async () => {
    render(<JargonTip term="PAYE" explanation="Pay As You Earn — your employer deducts tax automatically." />)
    await userEvent.hover(screen.getByText('PAYE'))
    expect(screen.getByText(/Pay As You Earn/)).toBeInTheDocument()
  })
})
