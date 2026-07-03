/**
 * T007 — ModalFooter: shared, solid-light, Button-variant modal footer.
 *
 * Verifies the contract the four modals adopt in T018: actions are <Button> variants
 * (never raw DaisyUI footer buttons), the primary is full-width on mobile via the
 * shared layout class, a status slot surfaces validation/errors, and a destructive
 * action uses the danger variant pushed to the left edge on desktop.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ModalFooter from '../ModalFooter'

describe('ModalFooter — actions are Button variants', () => {
  it('renders primary and secondary as shared Buttons, not raw DaisyUI footer buttons', () => {
    render(
      <ModalFooter
        primary={{ label: 'Save bean', onClick: () => {} }}
        secondary={{ label: 'Cancel', onClick: () => {} }}
      />,
    )
    const save = screen.getByRole('button', { name: 'Save bean' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(save.className).toContain('btn')
    expect(save.className).toContain('btn-primary')
    expect(cancel.className).toContain('btn-ghost')
    // The legacy raw `.modal-action` footer container must not be reintroduced.
    expect(document.querySelector('.modal-action')).toBeNull()
  })

  it('fires the action handlers', () => {
    const onPrimary = vi.fn()
    const onSecondary = vi.fn()
    render(
      <ModalFooter
        primary={{ label: 'Save', onClick: onPrimary }}
        secondary={{ label: 'Cancel', onClick: onSecondary }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onPrimary).toHaveBeenCalledOnce()
    expect(onSecondary).toHaveBeenCalledOnce()
  })
})

describe('ModalFooter — status + states', () => {
  it('renders the status slot and disables/labels the primary while loading', () => {
    render(
      <ModalFooter
        status={<span>Could not save</span>}
        primary={{ label: 'Save', onClick: () => {}, loading: true, loadingText: 'Saving…' }}
      />,
    )
    expect(screen.getByText('Could not save')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Saving…' })
    expect(save).toBeDisabled()
  })

  it('renders a destructive action with the danger variant pushed to the left edge', () => {
    render(
      <ModalFooter
        destructive={{ label: 'Delete', onClick: () => {} }}
        primary={{ label: 'Save', onClick: () => {} }}
      />,
    )
    const del = screen.getByRole('button', { name: 'Delete' })
    expect(del.className).toContain('text-error')
    expect(del.className).toContain('kaapi-modal-footer__destructive')
  })
})
