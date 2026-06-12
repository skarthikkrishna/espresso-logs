/**
 * T016 — Unit tests for Textarea.tsx
 *
 * Covers: base classes, error state, textareaSize, forwardRef, native attr pass-through.
 */

import React, { createRef } from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Textarea from '../Textarea'

describe('Textarea — base classes', () => {
  it('always applies textarea textarea-bordered input-styled w-full classes', () => {
    const { container } = render(<Textarea />)
    const ta = container.querySelector('textarea')
    expect(ta).toHaveClass('textarea')
    expect(ta).toHaveClass('textarea-bordered')
    expect(ta).toHaveClass('input-styled')
    expect(ta).toHaveClass('w-full')
  })
})

describe('Textarea — error state', () => {
  it('error=true adds input-error class', () => {
    const { container } = render(<Textarea error />)
    expect(container.querySelector('textarea')).toHaveClass('input-error')
  })

  it('error=false (default) does not add input-error', () => {
    const { container } = render(<Textarea />)
    expect(container.querySelector('textarea')).not.toHaveClass('input-error')
  })
})

describe('Textarea — size', () => {
  it('textareaSize=sm adds textarea-sm class', () => {
    const { container } = render(<Textarea textareaSize="sm" />)
    expect(container.querySelector('textarea')).toHaveClass('textarea-sm')
  })

  it('textareaSize=md (default) adds no size class', () => {
    const { container } = render(<Textarea />)
    expect(container.querySelector('textarea')).not.toHaveClass('textarea-sm')
  })
})

describe('Textarea — native attribute pass-through', () => {
  it('passes placeholder through to the underlying textarea', () => {
    const { container } = render(<Textarea placeholder="Add tasting notes…" />)
    expect(container.querySelector('textarea')).toHaveAttribute(
      'placeholder',
      'Add tasting notes…',
    )
  })

  it('passes rows attribute through', () => {
    const { container } = render(<Textarea rows={4} />)
    expect(container.querySelector('textarea')).toHaveAttribute('rows', '4')
  })
})

describe('Textarea — forwardRef', () => {
  it('forwards ref to the underlying <textarea> DOM element', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textarea ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('TEXTAREA')
  })
})
