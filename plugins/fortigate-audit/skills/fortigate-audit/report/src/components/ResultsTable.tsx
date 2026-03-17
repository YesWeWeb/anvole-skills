import { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react';
import { cn, getControlId, severityOrder, statusOrder, compareControlIds } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import SeverityBadge from './SeverityBadge';
import type { Control } from '@/types/audit';
import type { Filters } from './FilterBar';

type SortColumn = 'id' | 'severity' | 'status';
type SortDir = 'asc' | 'desc';

interface ResultsTableProps {
  controls: Control[];
  filters: Filters;
  onSelect: (index: number) => void;
  activeIndex: number | null;
}

export default function ResultsTable({ controls, filters, onSelect, activeIndex }: ResultsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedRemed, setExpandedRemed] = useState<Set<number>>(new Set());

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    return controls.map((c, i) => ({ control: c, originalIndex: i })).filter(({ control }) => {
      const searchLower = filters.search.toLowerCase();
      if (searchLower && !(
        control.title.toLowerCase().includes(searchLower) ||
        control.expected.toLowerCase().includes(searchLower) ||
        control.observed.toLowerCase().includes(searchLower)
      )) return false;

      if (filters.statuses.length > 0 && !filters.statuses.includes(control.verdict)) return false;
      if (filters.section && control.section !== filters.section) return false;

      if (filters.severities.length > 0) {
        const sev = control.severity?.toLowerCase() || '';
        if (!sev || !filters.severities.includes(sev)) return false;
      }

      return true;
    });
  }, [controls, filters]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'id': {
          const idA = getControlId(a.control.title) || a.control.title;
          const idB = getControlId(b.control.title) || b.control.title;
          cmp = compareControlIds(idA, idB);
          break;
        }
        case 'severity': {
          const sa = severityOrder[a.control.severity?.toLowerCase() || ''] || 0;
          const sb = severityOrder[b.control.severity?.toLowerCase() || ''] || 0;
          cmp = sa - sb;
          break;
        }
        case 'status': {
          cmp = (statusOrder[a.control.verdict] || 0) - (statusOrder[b.control.verdict] || 0);
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filtered, sortColumn, sortDir]);

  const toggleRemed = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setExpandedRemed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-gray-50/50 dark:bg-gray-800/30">
            <th
              className="cursor-pointer select-none px-4 py-3 text-left font-medium text-muted-foreground hover:text-foreground"
              style={{ width: '8rem' }}
              onClick={() => handleSort('id')}
            >
              <div className="flex items-center gap-1">Contrôle <SortIcon col="id" /></div>
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Titre</th>
            <th
              className="cursor-pointer select-none px-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
              style={{ width: '7rem' }}
              onClick={() => handleSort('severity')}
            >
              <div className="flex items-center justify-center gap-1">Sévérité <SortIcon col="severity" /></div>
            </th>
            <th
              className="cursor-pointer select-none px-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
              style={{ width: '7rem' }}
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center justify-center gap-1">Statut <SortIcon col="status" /></div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ control, originalIndex }) => {
            const controlId = getControlId(control.title);
            const titleText = controlId ? control.title.replace(/^[\d.]+|^A\.\d+/, '').replace(/^\s*—?\s*/, '') : control.title;
            const isActive = activeIndex === originalIndex;
            const hasRemed = control.verdict === 'FAIL' && control.remediation;
            const isRemedExpanded = expandedRemed.has(originalIndex);

            return (
              <tr
                key={originalIndex}
                data-index={originalIndex}
                onClick={() => onSelect(originalIndex)}
                className={cn(
                  "cursor-pointer border-b border-border transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  isActive && "bg-blue-50/50 dark:bg-blue-900/20 shadow-[inset_3px_0_0_theme(colors.blue.500)]"
                )}
              >
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-muted-foreground">{controlId || '—'}</code>
                </td>
                <td className="px-4 py-3">
                  <div className="text-foreground">{titleText}</div>
                  {hasRemed && (
                    <div className="mt-1">
                      <button
                        onClick={(e) => toggleRemed(e, originalIndex)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {isRemedExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Remédiation
                      </button>
                      {isRemedExpanded && (
                        <pre className="mt-1 rounded-md bg-gray-900 p-3 text-xs text-gray-100 overflow-x-auto dark:bg-gray-950">
                          <code>{control.remediation}</code>
                        </pre>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <SeverityBadge severity={control.severity} />
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge verdict={control.verdict} />
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                Aucun contrôle ne correspond aux filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Export for external use by DetailPanel navigation
export function getVisibleIndices(controls: Control[], filters: Filters, sortColumn: SortColumn | null = null, sortDir: SortDir = 'asc'): number[] {
  let items = controls.map((c, i) => ({ control: c, originalIndex: i })).filter(({ control }) => {
    const searchLower = filters.search.toLowerCase();
    if (searchLower && !(control.title.toLowerCase().includes(searchLower) || control.expected.toLowerCase().includes(searchLower) || control.observed.toLowerCase().includes(searchLower))) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(control.verdict)) return false;
    if (filters.section && control.section !== filters.section) return false;
    if (filters.severities.length > 0) {
      const sev = control.severity?.toLowerCase() || '';
      if (!sev || !filters.severities.includes(sev)) return false;
    }
    return true;
  });

  if (sortColumn) {
    items = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'id': {
          const idA = getControlId(a.control.title) || a.control.title;
          const idB = getControlId(b.control.title) || b.control.title;
          cmp = compareControlIds(idA, idB);
          break;
        }
        case 'severity':
          cmp = (severityOrder[a.control.severity?.toLowerCase() || ''] || 0) - (severityOrder[b.control.severity?.toLowerCase() || ''] || 0);
          break;
        case 'status':
          cmp = (statusOrder[a.control.verdict] || 0) - (statusOrder[b.control.verdict] || 0);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }

  return items.map(i => i.originalIndex);
}
