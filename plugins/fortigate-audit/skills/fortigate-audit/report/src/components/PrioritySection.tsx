import { cn } from '@/lib/utils';
import type { Priority } from '@/types/audit';

interface PrioritySectionProps {
  priorities: Priority[];
}

const levelColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critique: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  haute: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  high: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  moyenne: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
};

function getColor(level: string) {
  const key = level.toLowerCase().replace(/\s*\(.*\)/, '').trim();
  return levelColors[key] || { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' };
}

export default function PrioritySection({ priorities }: PrioritySectionProps) {
  if (priorities.length === 0) return null;

  return (
    <div className="space-y-4 print-break-inside-avoid">
      <h2 className="text-lg font-semibold text-foreground">Priorités de remédiation</h2>
      {priorities.map((p, i) => {
        const color = getColor(p.level);
        return (
          <div key={i} className={cn('rounded-xl border p-4', color.bg, color.border)}>
            <h3 className={cn('text-sm font-semibold mb-1', color.text)}>{p.level}</h3>
            <p className="text-sm text-muted-foreground mb-3">{p.description}</p>
            {p.items.length > 0 && (
              <ul className="space-y-1.5">
                {p.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <div className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', color.dot)} />
                    <span>
                      <code className="text-xs font-mono text-muted-foreground mr-1">{item.id}</code>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
