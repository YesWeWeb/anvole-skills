import { Shield, Printer } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import type { AuditReport } from '@/types/audit';

interface HeaderProps {
  data: AuditReport;
}

export default function Header({ data }: HeaderProps) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{data.title || 'Rapport d\'audit FortiGate'}</h1>
            <p className="text-sm text-muted-foreground">
              {data.timestamp ? new Date(data.timestamp).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Printer className="h-4 w-4" />
            Exporter PDF
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Device info badges */}
      {Object.keys(data.deviceInfo).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(data.deviceInfo).map(([key, val]) => (
            <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{key}</span>
              <span>{val}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <span className="font-medium">ID</span>
            <code className="font-mono">{data.reportId}</code>
          </span>
        </div>
      )}
    </header>
  );
}
