import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EntityFormActions } from '../EntityFormActions'

describe('EntityFormActions', () => {
  it('renders actions in primary, secondary, destructive order with live state', () => {
    const { container } = render(
      <EntityFormActions
        primaryLabel="Save"
        secondaryLabel="Cancel"
        destructiveLabel="Delete"
        isDirty
      />
    )

    const buttons = within(container.querySelector('.entity-form-actions__buttons') as HTMLElement)
      .getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Save', 'Cancel', 'Delete'])
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes.')
    expect(container.querySelector('.entity-form-actions')).toHaveAttribute('data-dirty', 'true')
    buttons.forEach((button) => {
      expect(button).toHaveClass('entity-form-actions__button')
    })
  })

  it('announces submitting and disables every action without a fixed overlay', () => {
    render(
      <EntityFormActions
        primaryLabel="Save"
        secondaryLabel="Cancel"
        destructiveLabel="Delete"
        isSubmitting
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Saving…')
    expect(screen.getByRole('button', { name: 'Saving Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('keeps a disabled primary action silent unless contextual status is provided', () => {
    const { rerender } = render(<EntityFormActions primaryLabel="Save" disabled />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    rerender(<EntityFormActions primaryLabel="Save" disabled statusMessage="Select a bag to log this shot." />)
    expect(screen.getByRole('status')).toHaveTextContent('Select a bag to log this shot.')
  })

  it('wires button callbacks and assertive errors while keeping submit as the default primary type', () => {
    const handlePrimary = vi.fn()
    const handleSecondary = vi.fn()
    const handleDestructive = vi.fn()

    render(
      <EntityFormActions
        primaryLabel="Save"
        onPrimary={handlePrimary}
        secondaryLabel="Cancel"
        onSecondary={handleSecondary}
        destructiveLabel="Delete"
        onDestructive={handleDestructive}
        errorMessage="Could not save."
      />
    )

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit')
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handlePrimary).toHaveBeenCalledTimes(1)
    expect(handleSecondary).toHaveBeenCalledTimes(1)
    expect(handleDestructive).toHaveBeenCalledTimes(1)
  })
})
