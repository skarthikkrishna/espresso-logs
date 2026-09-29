// FR11: NotFound renders the tone not-found state card with a home CTA.
// breaks: a user hitting a bad URL sees an untoned/broken 404 with no way back home.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import NotFound from './NotFound'
import { COPY } from '../copy'

function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>,
  )
}

describe('NotFound', () => {
  it('renders the not-found tone state card', () => {
    renderNotFound()
    const card = screen.getByRole('heading', { name: COPY.notFound.title }).closest('.tone-state-card')
    expect(card).not.toBeNull()
    expect(card).toHaveAttribute('data-state', 'not-found')
  })

  // FR11 / D1 / D9 / D11 / NFR3: the single state card must nest inside a NON-CARD data-tone emitter
  // (TonePageWrapper), never a TakeoverCard wrapping it, and the tone is LOCKED dark (D11). breaks:
  // (a) a bare ToneProvider emits no data-tone → 404 renders permanently light regardless of persisted
  // tone; (b) a TakeoverCard around the ToneStateCard is the rejected card-in-card; (c) a non-locked
  // provider → a beige-persisted user gets a beige 404 on the dark bg.
  it('nests the single state card inside a non-card data-tone emitter locked to dark (no card-in-card)', () => {
    renderNotFound()
    const card = screen.getByRole('heading', { name: COPY.notFound.title }).closest('.tone-state-card')
    const emitter = card?.closest('[data-tone]')
    expect(emitter).not.toBeNull()
    expect(emitter?.getAttribute('data-tone')).toBe('dark')
    // D9: emitter is the non-card TonePageWrapper, NOT a glass TakeoverCard; and no card wraps the card.
    expect(emitter).not.toHaveClass('kk-takeover-card')
    expect(card?.closest('.kk-takeover-card')).toBeNull()
  })

  it('shows the body copy and a primary home link', () => {
    renderNotFound()
    expect(screen.getByText(COPY.notFound.body)).toBeInTheDocument()
    const home = screen.getByRole('link', { name: COPY.notFound.goHome })
    expect(home).toHaveAttribute('href', '/')
    expect(home).toHaveClass('kk-tc-primary-btn')
  })
})
