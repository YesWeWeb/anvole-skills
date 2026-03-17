import { CheckCircle, XCircle, AlertTriangle, Minus, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Summary } from '@/types/audit';

interface SummaryCardsProps {
  summary: Summary;
}

const cards = [
  { key: 'total' as const, label: 'Total', icon: BarChart3, iconColor: 'text-blue-500', bgIcon: 'bg-blue-50 dark:bg-blue-900/30' },
  { key: 'pass' as const, label: 'Conformes', icon: CheckCircle, iconColor: 'text-emerald-500', bgIcon: 'bg-emerald-50 dark:bg-emerald-900/30' },
  { key: 'fail' as const, label: 'Non conformes', icon: XCircle, iconColor: 'text-red-500', bgIcon: 'bg-red-50 dark:bg-red-900/30' },
  { key: 'manual' as const, label: 'A vérifier', icon: AlertTriangle, iconColor: 'text-gray-500', bgIcon: 'bg-gray-50 dark:bg-gray-800/50' },
  { key: 'na' as const, label: 'Non applicable', icon: Minus, iconColor: 'text-slate-500', bgIcon: 'bg-slate-50 dark:bg-slate-800/50' },
] as const;

const barColors: Record<string, string> = {
  pass: 'bg-emerald-500', fail: 'bg-red-500', manual: 'bg-gray-400', na: 'bg-slate-300',
};

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 print-break-inside-avoid">
      {cards.map(({ key, label, icon: Icon, iconColor, bgIcon }) => {
        const value = key === 'total' ? summary.total : summary[key];
        if (key !== 'total' && value === 0) return null;

        const pct = summary.total > 0 ? Math.round((value / summary.total) * 100) : 0;

        return (
          <div key={key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              <div className={cn('rounded-lg p-1.5', bgIcon)}>
                <Icon className={cn('h-4 w-4', iconColor)} />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            {key === 'total' ? (
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                {(['pass', 'fail', 'manual', 'na'] as const).map(k => {
                  const w = summary.total > 0 ? (summary[k] / summary.total) * 100 : 0;
                  if (w === 0) return null;
                  return <div key={k} className={cn('h-full', barColors[k])} style={{ width: `${w}%` }} />;
                })}
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={cn('h-full rounded-full transition-all', barColors[key])} style={{ width: `${pct}%` }} />
                </div>
                <span className="mt-1 text-xs text-muted-foreground">{pct}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
