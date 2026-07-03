import type { ReactNode } from 'react'
import { SectionHeader } from './SectionHeader'

interface EntityFormSectionProps {
  title: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function EntityFormSection({
  title,
  children,
  className = '',
  bodyClassName = '',
}: EntityFormSectionProps) {
  return (
    <section className={['kk-entity-form-section', className].filter(Boolean).join(' ')}>
      <SectionHeader>{title}</SectionHeader>
      <div className={['kk-entity-form-section__body', bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </section>
  )
}
