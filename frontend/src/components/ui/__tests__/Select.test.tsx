/**
 * T016 — Unit tests for Select.tsx
 *
 * Covers: base classes, error state, selectSize, children rendering, forwardRef.
 */

import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Select from '../Select'

describe('Select — base classes', () => {
  it('always applies select select-bordered input-styled w-full classes', () => {
    const { container } = render(
      <Select>
        <option value="">Choose</option>
      </Select>,
    )
    const select = container.querySelector('select')
    expect(select).toHaveClass('select')
    expect(select).toHaveClass('select-bordered')
    expect(select).toHaveClass('input-styled')
    expect(select).toHaveClass('w-full')
  })
})

describe('Select — error state', () => {
  it('error=true adds input-error class', () => {
    const { container } = render(
      <Select error>
        <option>Option</option>
      </Select>,
    )
    expect(container.querySelector('select')).toHaveClass('input-error')
  })

  it('error=false (default) does not add input-error', () => {
    const { container } = render(
      <Select>
        <option>Option</option>
      </Select>,
    )
    expect(container.querySelector('select')).not.toHaveClass('input-error')
  })
})

describe('Select — size', () => {
  it('selectSize=sm adds select-sm class', () => {
    const { container } = render(
      <Select selectSize="sm">
        <option>Option</option>
      </Select>,
    )
    expect(container.querySelector('select')).toHaveClass('select-sm')
  })

  it('selectSize=md (default) adds no size class', () => {
    const { container } = render(
      <Select>
        <option>Option</option>
      </Select>,
    )
    expect(container.querySelector('select')).not.toHaveClass('select-sm')
  })
})

describe('Select — children render inside <select>', () => {
  it('renders option children inside the select element', () => {
    render(
      <Select>
        <option value="light">Light</option>
        <option value="medium">Medium</option>
      </Select>,
    )
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Light')
    expect(options[1]).toHaveTextContent('Medium')
  })
})

describe('Select — forwardRef', () => {
  it('forwards ref to the underlying <select> DOM element', () => {
    const ref = createRef<HTMLSelectElement>()
    render(
      <Select ref={ref}>
        <option>Option</option>
      </Select>,
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('SELECT')
  })
})
