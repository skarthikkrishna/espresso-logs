/**
 * T016 — Unit tests for Input.tsx
 *
 * Covers: base classes, error state, inputSize, forwardRef, native attr pass-through.
 */

import React, { createRef } from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Input from '../Input'

describe('Input — base classes', () => {
  it('always applies input input-bordered input-styled w-full classes', () => {
    const { container } = render(<Input />)
    const input = container.querySelector('input')
    expect(input).toHaveClass('input')
    expect(input).toHaveClass('input-bordered')
    expect(input).toHaveClass('input-styled')
    expect(input).toHaveClass('w-full')
  })
})

describe('Input — error state', () => {
  it('error=true adds input-error class', () => {
    const { container } = render(<Input error />)
    expect(container.querySelector('input')).toHaveClass('input-error')
  })

  it('error=false (default) does not add input-error class', () => {
    const { container } = render(<Input />)
    expect(container.querySelector('input')).not.toHaveClass('input-error')
  })
})

describe('Input — size', () => {
  it('inputSize=sm adds input-sm class', () => {
    const { container } = render(<Input inputSize="sm" />)
    expect(container.querySelector('input')).toHaveClass('input-sm')
  })

  it('inputSize=md (default) adds no size class', () => {
    const { container } = render(<Input inputSize="md" />)
    expect(container.querySelector('input')).not.toHaveClass('input-sm')
  })
})

describe('Input — native attribute pass-through', () => {
  it('passes placeholder to the underlying input', () => {
    const { container } = render(<Input placeholder="Enter dose" />)
    expect(container.querySelector('input')).toHaveAttribute('placeholder', 'Enter dose')
  })

  it('passes type attribute through', () => {
    const { container } = render(<Input type="number" />)
    expect(container.querySelector('input')).toHaveAttribute('type', 'number')
  })
})

describe('Input — forwardRef', () => {
  it('forwards ref to the underlying <input> DOM element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('INPUT')
  })
})
