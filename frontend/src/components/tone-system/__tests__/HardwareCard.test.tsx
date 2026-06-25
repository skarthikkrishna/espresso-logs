import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ToneProvider } from '../../../contexts/ToneContext'
import type { HardwareItem } from '../../../types/entities'
import { HardwareCard } from '../HardwareCard'

const machine: HardwareItem = {
  hardware_id: 'hw-1',
  category: 'Machine',
  maker: 'La Marzocco',
  name: 'La Marzocco Linea Micra',
  purchase_date: '2025-11-15',
  image_path: '/static/hardware/linea-micra.jpg',
}

function Wrapper({ children }: { children: ReactNode }) {
  return <ToneProvider>{children}</ToneProvider>
}

describe('HardwareCard', () => {
  it('renders hardware through the canonical card anatomy with category as a chip', () => {
    render(
      <Wrapper>
        <HardwareCard item={machine} onSelect={vi.fn()} data-testid="hardware-card" />
      </Wrapper>
    )

    expect(screen.getByTestId('hardware-card')).toHaveClass('entity-card', 'hardware-card')
    expect(screen.getByText('La Marzocco Linea Micra')).toHaveClass('entity-card-title')
    expect(screen.getByText('Nov 15, 2025').closest('.entity-card-date')).toBeInTheDocument()
    expect(screen.getByText('La Marzocco')).toHaveClass('entity-card-eyebrow')
    expect(screen.getByTestId('hardware-category-chip')).toHaveTextContent('Machine')
    expect(screen.queryByText('GEAR')).not.toBeInTheDocument()
  })

  it('omits the maker eyebrow gracefully when maker is null', () => {
    const { container } = render(
      <Wrapper>
        <HardwareCard item={{ ...machine, maker: null }} onSelect={vi.fn()} />
      </Wrapper>
    )

    expect(container.querySelector('.entity-card-eyebrow')).toBeNull()
    expect(screen.getByTestId('hardware-category-chip')).toHaveTextContent('Machine')
  })

  it('uses image_path in the shared 4:3 image slot', () => {
    render(
      <Wrapper>
        <HardwareCard item={machine} onSelect={vi.fn()} />
      </Wrapper>
    )

    const img = screen.getByRole('img', { name: 'La Marzocco Linea Micra' })
    expect(img).toHaveAttribute('src', '/static/hardware/linea-micra.jpg')
    expect(img.closest('.entity-card-figure')).toBeInTheDocument()
  })

  it('falls back to a neutral image placeholder when image_path is absent', () => {
    const { container } = render(
      <Wrapper>
        <HardwareCard item={{ ...machine, image_path: undefined }} onSelect={vi.fn()} />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-image-placeholder')).toBeInTheDocument()
    expect(container.querySelector('.entity-card-monogram')).toBeNull()
  })

  it('selects the item from the whole card button', () => {
    const onSelect = vi.fn()
    render(
      <Wrapper>
        <HardwareCard item={machine} onSelect={onSelect} />
      </Wrapper>
    )

    fireEvent.click(screen.getByRole('button', { name: /La Marzocco.*La Marzocco Linea Micra.*Nov 15, 2025.*Machine/i }))
    expect(onSelect).toHaveBeenCalledWith(machine)
  })
})
