import { render, screen } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { MoreDrawer } from './MoreDrawer'

const props = {
  open: true, onClose: vi.fn(), onNavigate: vi.fn(), onSubmitFeedback: vi.fn(),
  onLock: vi.fn(),
}

describe('MoreDrawer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing when closed', () => {
    const { container } = render(<MoreDrawer {...props} open={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists every entry in order, with Tax Return first', () => {
    render(<MoreDrawer {...props} />)
    const labels = screen.getAllByRole('button')
      .map(b => b.textContent?.trim() ?? '')
      .filter(t => t !== '')
    expect(labels).toEqual([
      'Tax Return',
      'Account & profile',
      'Price settings',
      'Submit feedback',
      'Lock',
    ])
  })

  it('navigates to the tax return route', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /tax return/i }).click()
    expect(props.onNavigate).toHaveBeenCalledWith('/return')
  })

  it('navigates to the account route', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /account & profile/i }).click()
    expect(props.onNavigate).toHaveBeenCalledWith('/account')
  })

  it('deep-links price settings to the Shares screen', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /price settings/i }).click()
    expect(props.onNavigate).toHaveBeenCalledWith('/shares')
  })

  it('triggers the feedback form', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /submit feedback/i }).click()
    expect(props.onSubmitFeedback).toHaveBeenCalled()
  })

  it('triggers lock', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /lock/i }).click()
    expect(props.onLock).toHaveBeenCalled()
  })

  it('closes from the close button', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /close/i }).click()
    expect(props.onClose).toHaveBeenCalled()
  })

  it('closes when the backdrop is clicked', () => {
    const { container } = render(<MoreDrawer {...props} />)
    const backdrop = container.querySelector('[aria-hidden]') as HTMLElement
    backdrop.click()
    expect(props.onClose).toHaveBeenCalled()
  })
})
