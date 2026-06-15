/**
 * TitleIcon tests — src/monogram/fallback branching + data-testid passthrough.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TitleIcon } from '../TitleIcon'

describe('TitleIcon', () => {
  it('renders an img when src is provided', () => {
    render(<TitleIcon src="https://example.com/bean.jpg" alt="Test Bean" />)
    const img = screen.getByRole('img', { name: 'Test Bean' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/bean.jpg')
  })

  it('renders ☕ fallback when no src and no monogram', () => {
    render(<TitleIcon />)
    expect(screen.getByText('☕')).toBeInTheDocument()
  })

  it('renders monogram letter in kk-tc-title-icon-monogram span when monogram is set', () => {
    render(<TitleIcon monogram="S" />)
    const monogramEl = screen.getByText('S')
    expect(monogramEl).toBeInTheDocument()
    expect(monogramEl).toHaveClass('kk-tc-title-icon-monogram')
  })

  it('monogram takes precedence over default ☕ fallback', () => {
    render(<TitleIcon monogram="V" />)
    expect(screen.getByText('V')).toBeInTheDocument()
    expect(screen.queryByText('☕')).not.toBeInTheDocument()
  })

  it('custom fallback renders when no src and no monogram', () => {
    render(<TitleIcon fallback={<span>custom</span>} />)
    expect(screen.getByText('custom')).toBeInTheDocument()
    expect(screen.queryByText('☕')).not.toBeInTheDocument()
  })

  it('monogram takes precedence over custom fallback', () => {
    render(<TitleIcon monogram="B" fallback={<span>custom</span>} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.queryByText('custom')).not.toBeInTheDocument()
  })

  it('applies default data-testid to placeholder when no testid provided', () => {
    render(<TitleIcon />)
    expect(screen.getByTestId('catalog-image-placeholder')).toBeInTheDocument()
  })

  it('passes custom data-testid to placeholder', () => {
    render(<TitleIcon data-testid="my-icon-placeholder" />)
    expect(screen.getByTestId('my-icon-placeholder')).toBeInTheDocument()
  })

  it('does not render placeholder when src is provided', () => {
    render(<TitleIcon src="https://example.com/bean.jpg" data-testid="should-not-appear" />)
    expect(screen.queryByTestId('should-not-appear')).not.toBeInTheDocument()
  })

  it('renders overlay children alongside an image', () => {
    render(
      <TitleIcon src="https://example.com/bean.jpg" alt="Bean">
        <button>Replace</button>
      </TitleIcon>
    )
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})
