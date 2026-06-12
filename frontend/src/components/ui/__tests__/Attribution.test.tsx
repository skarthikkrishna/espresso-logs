import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Attribution from '../Attribution'

describe('Attribution', () => {
  it('does not render third-party icon attribution after custom brand adoption', () => {
    const { container } = render(<Attribution />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
