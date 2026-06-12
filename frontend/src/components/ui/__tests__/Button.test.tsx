/**
 * T014 — Unit tests for Button.tsx
 *
 * Covers: all 5 variants, all 4 sizes, loading state (spinner + aria-hidden),
 * disabled, forwardRef, loadingText, icon, fullWidth.
 *
 * Gate Note 2: secondary variant MUST assert toHaveClass('btn-secondary')
 * AND not.toHaveClass('bg-amber-800') — catches D-05 regression back to raw colors.
 */

import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Button from '../Button'

describe('Button — variants', () => {
  it('primary variant applies btn-primary class', () => {
    render(<Button variant="primary">Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toHaveClass('btn-primary')
  })

  it('secondary variant applies btn-secondary token class (Note 2 — intent check)', () => {
    render(<Button variant="secondary">Cancel</Button>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    // Positive: token-driven class must be present
    expect(btn).toHaveClass('btn-secondary')
    // Negative (Rule 9): raw Tailwind color must NOT be present — catches D-05 regression
    expect(btn).not.toHaveClass('bg-amber-800')
    expect(btn).not.toHaveClass('bg-amber-800/60')
  })

  it('outline variant applies btn-outline class', () => {
    render(<Button variant="outline">Back</Button>)
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('btn-outline')
  })

  it('ghost variant applies btn-ghost class', () => {
    render(<Button variant="ghost">Edit</Button>)
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass('btn-ghost')
  })

  it('danger variant applies btn-ghost and text-error classes', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn).toHaveClass('btn-ghost')
    expect(btn).toHaveClass('text-error')
  })

  it('all variants carry base btn class', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole('button', { name: variant })).toHaveClass('btn')
      unmount()
    }
  })
})

describe('Button — sizes', () => {
  it('xs size applies btn-xs class', () => {
    render(<Button size="xs">Tiny</Button>)
    expect(screen.getByRole('button', { name: 'Tiny' })).toHaveClass('btn-xs')
  })

  it('sm size applies btn-sm class', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('btn-sm')
  })

  it('md size (default) adds no extra size class', () => {
    render(<Button size="md">Medium</Button>)
    const btn = screen.getByRole('button', { name: 'Medium' })
    expect(btn).not.toHaveClass('btn-xs')
    expect(btn).not.toHaveClass('btn-sm')
    expect(btn).not.toHaveClass('btn-lg')
  })

  it('lg size applies btn-lg class', () => {
    render(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('btn-lg')
  })
})

describe('Button — loading state', () => {
  it('loading=true disables the button', () => {
    render(<Button loading>Saving…</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('loading=true renders a spinner span with aria-hidden="true"', () => {
    const { container } = render(<Button loading>Saving…</Button>)
    const spinner = container.querySelector('.loading-spinner')
    expect(spinner).not.toBeNull()
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
  })

  it('loadingText replaces children label while loading', () => {
    render(<Button loading loadingText="Saving…">Submit</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Saving…')
    expect(screen.queryByText('Submit')).not.toBeInTheDocument()
  })

  it('children label shows when not loading', () => {
    render(<Button loading={false}>Submit</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Submit')
  })
})

describe('Button — disabled state', () => {
  it('disabled=true sets the disabled attribute', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDisabled()
  })
})

describe('Button — fullWidth', () => {
  it('fullWidth=true adds w-full class', () => {
    render(<Button fullWidth>Log shot</Button>)
    expect(screen.getByRole('button', { name: 'Log shot' })).toHaveClass('w-full')
  })

  it('fullWidth=false (default) does not add w-full', () => {
    render(<Button>Log shot</Button>)
    expect(screen.getByRole('button', { name: 'Log shot' })).not.toHaveClass('w-full')
  })
})

describe('Button — icon prop', () => {
  it('renders icon node before children when not loading', () => {
    const { container } = render(
      <Button icon={<span data-testid="icon">★</span>}>With Icon</Button>,
    )
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull()
  })

  it('hides icon when loading', () => {
    const { container } = render(
      <Button loading icon={<span data-testid="icon">★</span>}>With Icon</Button>,
    )
    expect(container.querySelector('[data-testid="icon"]')).toBeNull()
  })
})

describe('Button — forwardRef', () => {
  it('forwards ref to the underlying <button> DOM element', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Ref test</Button>)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('BUTTON')
  })
})
