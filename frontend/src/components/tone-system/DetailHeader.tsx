import type { ReactNode } from 'react'
import { TitleBlock } from './TitleBlock'

interface DetailHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  media?: ReactNode
  chips?: ReactNode
  actions?: ReactNode
}

export function DetailHeader({ title, subtitle, eyebrow, media, chips, actions }: DetailHeaderProps) {
  return (
    <header className="kk-detail-header kk-detail-header--unified">
      {media ? <div className="kk-detail-header__media">{media}</div> : null}
      <div className="kk-detail-header__main">
        {eyebrow ? <p className="kk-detail-header__eyebrow">{eyebrow}</p> : null}
        <TitleBlock title={title} subtitle={subtitle} />
        {chips ? <div className="kk-detail-header__chips">{chips}</div> : null}
      </div>
      {actions ? <div className="kk-detail-header__actions">{actions}</div> : null}
    </header>
  )
}
