import { getCategoryStats } from '@/lib/utils';
import type { Control } from '@/types/audit';

interface BarChartProps {
  controls: Control[];
}

const colors: Record<string, string> = {
  pass: '#10b981', fail: '#f43f5e', manual: '#6b7280', na: '#94a3b8',
};

export default function BarChart({ controls }: BarChartProps) {
  const categories = getCategoryStats(controls);
  const entries = Object.entries(categories);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Résultats par catégorie</h3>
      <div className="flex flex-col gap-3">
        {entries.map(([name, stats]) => (
          <div key={name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground truncate max-w-[70%]">{name}</span>
              <span className="text-xs text-muted-foreground">{stats.total}</span>
            </div>
            <div className="flex h-5 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
              {(['pass', 'fail', 'manual', 'na'] as const).map(key => {
                const w = stats.total > 0 ? (stats[key] / stats.total) * 100 : 0;
                if (w === 0) return null;
                return (
                  <div
                    key={key}
                    className="h-full transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${w}%`, backgroundColor: colors[key] }}
                  >
                    {w > 12 && <span className="text-[10px] font-medium text-white">{stats[key]}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
