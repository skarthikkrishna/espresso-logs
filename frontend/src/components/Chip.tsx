/** Generic pill/badge chip for categorical labels (roast level, machine category, etc.). */

interface ChipProps {
  label: string | null | undefined;
  className?: string;
}

export default function Chip({ label, className = '' }: ChipProps) {
  if (!label) return null;
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded bg-amber-900/30 text-amber-200/90 border border-amber-700/40 backdrop-blur-sm ${className}`.trim()}
    >
      {label}
    </span>
  );
}
