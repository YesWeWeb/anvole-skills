import type { Summary } from '@/types/audit';

interface DonutChartProps {
  summary: Summary;
}

const segments = [
  { key: 'pass' as const, label: 'PASS', color: '#10b981' },
  { key: 'fail' as const, label: 'FAIL', color: '#f43f5e' },
  { key: 'manual' as const, label: 'MANUAL', color: '#6b7280' },
  { key: 'na' as const, label: 'N/A', color: '#94a3b8' },
];

export default function DonutChart({ summary }: DonutChartProps) {
  const total = summary.pass + summary.fail + summary.manual + summary.na;
  if (total === 0) return null;

  const radius = 80;
  const stroke = 24;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Répartition des contrôles</h3>
      <div className="flex items-center gap-8">
        {/* SVG Donut */}
        <div className="relative flex-shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {segments.map(({ key, color }) => {
              const value = summary[key];
              if (value === 0) return null;
              const pct = value / total;
              const dashLength = pct * circumference;
              const dashOffset = -offset * circumference;
              offset += pct;
              return (
                <circle
                  key={key}
                  cx="100" cy="100" r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  className="transition-all duration-700"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{summary.score}%</span>
            <span className="text-xs text-muted-foreground">Conformité</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3">
          {segments.map(({ key, label, color }) => {
            const value = summary[key];
            if (value === 0) return null;
            const pct = Math.round((value / total) * 100);
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: color }} />
                <span className="text-sm text-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground">{value}</span>
                <span className="text-xs text-muted-foreground">({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
