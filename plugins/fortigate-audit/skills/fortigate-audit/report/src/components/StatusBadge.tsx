import { CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Verdict } from '@/types/audit';

const config: Record<Verdict, { icon: typeof CheckCircle; label: string; className: string }> = {
  PASS: {
    icon: CheckCircle,
    label: 'PASS',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  FAIL: {
    icon: XCircle,
    label: 'FAIL',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  MANUAL: {
    icon: AlertTriangle,
    label: 'MANUAL',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
  },
  'N/A': {
    icon: Minus,
    label: 'N/A',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
  },
};

interface StatusBadgeProps {
  verdict: Verdict;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ verdict, size = 'sm' }: StatusBadgeProps) {
  const { icon: Icon, label, className } = config[verdict];
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium', textSize, className)}>
      <Icon className={iconSize} />
      {label}
    </span>
  );
}
