import { useState, useMemo, useCallback } from 'react';
import { auditData } from '@/lib/auditData';
import Header from '@/components/Header';
import SummaryCards from '@/components/SummaryCards';
import DonutChart from '@/components/DonutChart';
import BarChart from '@/components/BarChart';
import FilterBar, { type Filters } from '@/components/FilterBar';
import ResultsTable from '@/components/ResultsTable';
import DetailPanel from '@/components/DetailPanel';
import PrioritySection from '@/components/PrioritySection';

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    statuses: [],
    severities: [],
    section: '',
  });

  const sections = useMemo(() => {
    const s = new Set(auditData.controls.map(c => c.section));
    return [...s];
  }, []);

  const availableSeverities = useMemo(() => {
    const s = new Set(auditData.controls.map(c => c.severity?.toLowerCase()).filter(Boolean) as string[]);
    return [...s].sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a] ?? 99) - (order[b] ?? 99);
    });
  }, []);

  // Compute visible indices for panel navigation
  const visibleIndices = useMemo(() => {
    return auditData.controls
      .map((c, i) => ({ control: c, index: i }))
      .filter(({ control }) => {
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
      })
      .map(({ index }) => index);
  }, [filters]);

  const currentPosInVisible = selectedIndex !== null ? visibleIndices.indexOf(selectedIndex) : -1;

  const handleNavigatePrevious = useCallback(() => {
    if (currentPosInVisible > 0) {
      setSelectedIndex(visibleIndices[currentPosInVisible - 1]);
    }
  }, [currentPosInVisible, visibleIndices]);

  const handleNavigateNext = useCallback(() => {
    if (currentPosInVisible >= 0 && currentPosInVisible < visibleIndices.length - 1) {
      setSelectedIndex(visibleIndices[currentPosInVisible + 1]);
    }
  }, [currentPosInVisible, visibleIndices]);

  const selectedControl = selectedIndex !== null ? auditData.controls[selectedIndex] : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-6">
        <Header data={auditData} />

        <div className="space-y-6">
          {/* Summary Cards */}
          <SummaryCards summary={auditData.summary} />

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DonutChart summary={auditData.summary} />
            <BarChart controls={auditData.controls} />
          </div>

          {/* Filters */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            sections={sections}
            availableSeverities={availableSeverities}
          />

          {/* Results Table */}
          <ResultsTable
            controls={auditData.controls}
            filters={filters}
            onSelect={setSelectedIndex}
            activeIndex={selectedIndex}
          />

          {/* Priorities */}
          <PrioritySection priorities={auditData.priorities} />

          {/* Footer */}
          <footer className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
            <p>Rapport généré le {auditData.timestamp ? new Date(auditData.timestamp).toLocaleString('fr-FR') : ''}</p>
            <p className="mt-1">
              ID : <code className="font-mono">{auditData.reportId}</code> — SHA256 : <code className="font-mono text-[10px]">{auditData.sourceHash?.slice(0, 16)}...</code>
            </p>
          </footer>
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        control={selectedControl}
        isOpen={selectedIndex !== null}
        onClose={() => setSelectedIndex(null)}
        onNavigatePrevious={currentPosInVisible > 0 ? handleNavigatePrevious : undefined}
        onNavigateNext={currentPosInVisible >= 0 && currentPosInVisible < visibleIndices.length - 1 ? handleNavigateNext : undefined}
        currentIndex={currentPosInVisible >= 0 ? currentPosInVisible + 1 : undefined}
        totalCount={visibleIndices.length}
      />
    </div>
  );
}
