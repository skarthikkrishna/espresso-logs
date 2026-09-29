// FR10: InviteInvalid renders the tone error state card with sign-in + create-account CTAs.
// breaks: a user with a bad invite link sees an untoned/broken page and can't recover.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import InviteInvalid from './InviteInvalid'
import { COPY } from '../copy'

function renderInviteInvalid() {
  return render(
    <MemoryRouter>
      <InviteInvalid />
    </MemoryRouter>,
  )
}

describe('InviteInvalid', () => {
  it('renders the error tone state card with the invalid title', () => {
    renderInviteInvalid()
    const card = screen.getByRole('heading', { name: COPY.invite.invalidTitle }).closest('.tone-state-card')
    expect(card).not.toBeNull()
    expect(card).toHaveAttribute('data-state', 'error')
  })

  it('shows the body copy', () => {
    renderInviteInvalid()
    expect(screen.getByText(COPY.invite.invalidBody)).toBeInTheDocument()
  })

  it('shows a primary sign-in link to /login', () => {
    renderInviteInvalid()
    const signIn = screen.getByRole('link', { name: COPY.invite.signIn })
    expect(signIn).toHaveAttribute('href', '/login')
    expect(signIn).toHaveClass('kk-tc-primary-btn')
  })

  it('shows a create-account link to /register', () => {
    renderInviteInvalid()
    const create = screen.getByRole('link', { name: COPY.invite.createAccount })
    expect(create).toHaveAttribute('href', '/register')
  })

  // FR10 / D1 / D9 / D11 / NFR3: the single state card nests in a non-card data-tone emitter (TonePageWrapper),
  // tone LOCKED dark (D11). breaks: (a) a bare ToneProvider emits no data-tone → the page renders permanently
  // light regardless of persisted tone; (b) a TakeoverCard around it is the rejected card-in-card; (c) a
  // non-locked provider → a beige-persisted user gets a beige invite card on the dark bg.
  it('nests the single state card inside a non-card data-tone emitter locked to dark (no card-in-card)', () => {
    renderInviteInvalid()
    const card = screen.getByRole('heading', { name: COPY.invite.invalidTitle }).closest('.tone-state-card')
    const emitter = card?.closest('[data-tone]')
    expect(emitter).not.toBeNull()
    expect(emitter?.getAttribute('data-tone')).toBe('dark')
    expect(emitter).not.toHaveClass('kk-takeover-card')
    expect(card?.closest('.kk-takeover-card')).toBeNull()
  })
})
