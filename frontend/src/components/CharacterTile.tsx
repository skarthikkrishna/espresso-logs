interface Props {
  roaster: string
  beanName: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'w-12 h-12 text-lg',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-24 h-24 text-4xl',
}

export default function CharacterTile({ roaster, beanName, size = 'md' }: Props) {
  const initials = `${roaster[0] ?? '?'}${beanName[0] ?? '?'}`.toUpperCase()
  return (
    <div
      className={`flex items-center justify-center rounded-lg font-display font-bold text-amber-100 ${SIZE_CLASSES[size]}`}
      style={{
        background: 'linear-gradient(135deg, #92400e 0%, #2d1f0e 100%)',
        border: '1px solid rgba(217, 119, 6, 0.3)',
      }}
      aria-label={`${roaster} ${beanName}`}
    >
      {initials}
    </div>
  )
}
