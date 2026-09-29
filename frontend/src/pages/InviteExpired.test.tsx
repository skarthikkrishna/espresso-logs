// FR9: InviteExpired renders the tone warning state card with a sign-in CTA.
// breaks: a user with an expired invite sees an untoned/broken page with no way to sign in.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import InviteExpired from './InviteExpired'
import { COPY } from '../copy'

function renderInviteExpired() {
  return render(
    <MemoryRouter>
      <InviteExpired />
    </MemoryRouter>,
  )
}

describe('InviteExpired', () => {
  it('renders the warning tone state card with the expired title', () => {
    renderInviteExpired()
    const card = screen.getByRole('heading', { name: COPY.invite.expiredTitle }).closest('.tone-state-card')
    expect(card).not.toBeNull()
    expect(card).toHaveAttribute('data-state', 'warning')
  })

  it('shows the body copy', () => {
    renderInviteExpired()
    expect(screen.getByText(COPY.invite.expiredBody)).toBeInTheDocument()
  })

  it('shows a primary sign-in link to /login', () => {
    renderInviteExpired()
    const signIn = screen.getByRole('link', { name: COPY.invite.signIn })
    expect(signIn).toHaveAttribute('href', '/login')
    expect(signIn).toHaveClass('kk-tc-primary-btn')
  })

  // FR9 / D1 / D9 / D11 / NFR3: the single state card nests in a non-card data-tone emitter (TonePageWrapper),
  // tone LOCKED dark (D11). breaks: (a) a bare ToneProvider emits no data-tone → the page renders permanently
  // light regardless of persisted tone; (b) a TakeoverCard around it is the rejected card-in-card; (c) a
  // non-locked provider → a beige-persisted user gets a beige invite card on the dark bg.
  it('nests the single state card inside a non-card data-tone emitter locked to dark (no card-in-card)', () => {
    renderInviteExpired()
    const card = screen.getByRole('heading', { name: COPY.invite.expiredTitle }).closest('.tone-state-card')
    const emitter = card?.closest('[data-tone]')
    expect(emitter).not.toBeNull()
    expect(emitter?.getAttribute('data-tone')).toBe('dark')
    expect(emitter).not.toHaveClass('kk-takeover-card')
    expect(card?.closest('.kk-takeover-card')).toBeNull()
  })
})
