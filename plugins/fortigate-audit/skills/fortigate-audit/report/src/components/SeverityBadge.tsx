import { cn } from '@/lib/utils';
import { severityColor } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: string | null;
}

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  if (!severity) return null;

  const colors = severityColor(severity);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        'opacity-60 hover:opacity-100 transition-opacity',
        colors.bg, colors.text
      )}
    >
      {severity}
    </span>
  );
}
