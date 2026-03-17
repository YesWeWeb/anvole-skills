import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Filters {
  search: string;
  statuses: string[];
  severities: string[];
  section: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sections: string[];
  availableSeverities: string[];
}

const allStatuses = ['PASS', 'FAIL', 'MANUAL', 'N/A'];

export default function FilterBar({ filters, onChange, sections, availableSeverities }: FilterBarProps) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggleStatus = (s: string) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    update({ statuses: next });
  };

  const toggleSeverity = (s: string) => {
    const next = filters.severities.includes(s)
      ? filters.severities.filter(x => x !== s)
      : [...filters.severities, s];
    update({ severities: next });
  };

  return (
    <div className="no-print space-y-3">
      {/* Row 1: Search + Status + Severity */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un contrôle..."
            value={filters.search}
            onChange={e => update({ search: e.target.value })}
            className={cn(
              "w-full rounded-lg border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          />
        </div>

        {/* Status toggles */}
        <div className="flex items-center gap-1.5">
          {allStatuses.map(s => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                filters.statuses.includes(s)
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Severity toggles */}
        {availableSeverities.length > 0 && (
          <div className="flex items-center gap-1.5">
            {availableSeverities.map(s => (
              <button
                key={s}
                onClick={() => toggleSeverity(s)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                  filters.severities.includes(s)
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "border-border bg-card text-muted-foreground hover:bg-accent"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Row 2: Section filter */}
      {sections.length > 1 && (
        <select
          value={filters.section}
          onChange={e => update({ section: e.target.value })}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Toutes les catégories</option>
          {sections.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
    </div>
  );
}
