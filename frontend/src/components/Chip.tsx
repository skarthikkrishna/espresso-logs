/** Generic pill/badge chip for categorical labels (roast level, machine category, etc.). */

interface ChipProps {
  label: string | null | undefined;
  variant?: 'roast' | 'machine' | 'default';
  className?: string;
}

const variantClasses: Record<NonNullable<ChipProps['variant']>, string> = {
  roast: 'bg-amber-900/25 text-amber-300 border border-amber-600/30',
  machine: 'bg-stone-900/30 text-stone-400 border border-stone-600/30',
  default: '',
};

export default function Chip({ label, variant = 'default', className = '' }: ChipProps) {
  if (!label) return null;
  return (
    <span
      className={`badge badge-sm text-xs px-2 py-0.5 ${variantClasses[variant]} ${className}`.trim()}
    >
      {label}
    </span>
  );
}
