/**
 * T005 — Unit tests for Pagination.tsx
 *
 * Covers: hidden when a single page; Previous/Next from the copy registry; bound
 * disabled states; aria-current on the active page; page-change callback; windowed
 * ellipsis; normal-flow nav landmark.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Pagination from '../Pagination'
import { COPY } from '../../../copy'

describe('Pagination — visibility', () => {
  it('renders nothing when there is one page or fewer', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onPageChange={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('Pagination — registry labels and landmark', () => {
  it('uses the operator copy registry for the nav label and prev/next', () => {
    render(<Pagination page={2} pageCount={5} onPageChange={() => {}} />)
    expect(screen.getByRole('navigation', { name: COPY.pagination.label })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.pagination.previous })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.pagination.next })).toBeInTheDocument()
  })
})

describe('Pagination — bound states', () => {
  it('disables Previous on the first page', () => {
    render(<Pagination page={1} pageCount={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: COPY.pagination.previous })).toBeDisabled()
    expect(screen.getByRole('button', { name: COPY.pagination.next })).not.toBeDisabled()
  })

  it('disables Next on the last page', () => {
    render(<Pagination page={5} pageCount={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: COPY.pagination.next })).toBeDisabled()
    expect(screen.getByRole('button', { name: COPY.pagination.previous })).not.toBeDisabled()
  })
})

describe('Pagination — current page', () => {
  it('marks the active page button with aria-current="page"', () => {
    render(<Pagination page={3} pageCount={5} onPageChange={() => {}} />)
    const current = screen.getByRole('button', { name: '3' })
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '2' })).not.toHaveAttribute('aria-current')
  })

  it('44×44 minimums are applied to page controls', () => {
    render(<Pagination page={1} pageCount={3} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: '1' })).toHaveClass('min-h-[2.75rem]')
    expect(screen.getByRole('button', { name: '1' })).toHaveClass('min-w-[2.75rem]')
  })
})

describe('Pagination — page change', () => {
  it('calls onPageChange with the clicked page number', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('Previous and Next step by one', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} pageCount={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole('button', { name: COPY.pagination.previous }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: COPY.pagination.next }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })
})

describe('Pagination — windowing', () => {
  it('collapses long ranges with a decorative ellipsis', () => {
    render(<Pagination page={6} pageCount={12} onPageChange={() => {}} siblingCount={1} />)
    // First and last anchors always shown
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument()
    // Distant pages are not rendered
    expect(screen.queryByRole('button', { name: '3' })).toBeNull()
  })
})
