import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { FeedbackForm } from './FeedbackForm'

const onClose = vi.fn()

const textArea = () => screen.getByPlaceholderText(/bugs, ideas/i)
const sendButton = () => screen.getByRole('button', { name: /^send$/i })

describe('FeedbackForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<FeedbackForm open={false} onClose={onClose} screen="Dashboard" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('disables Send for empty or whitespace-only text', () => {
    render(<FeedbackForm open onClose={onClose} screen="Dashboard" />)

    expect(sendButton()).toBeDisabled()

    fireEvent.change(textArea(), { target: { value: '   ' } })
    expect(sendButton()).toBeDisabled()

    fireEvent.change(textArea(), { target: { value: 'Something is broken' } })
    expect(sendButton()).not.toBeDisabled()
  })

  it('shows a plain-English error and does not throw when no data repo is configured', async () => {
    render(<FeedbackForm open onClose={onClose} screen="Dashboard" />)

    fireEvent.change(textArea(), { target: { value: 'Something is broken' } })
    fireEvent.click(sendButton())

    expect(await screen.findByText(/data repo connected/i)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
