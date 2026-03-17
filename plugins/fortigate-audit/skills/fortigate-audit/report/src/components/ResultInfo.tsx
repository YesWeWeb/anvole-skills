import { cn, verdictColor, getControlId } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import SeverityBadge from './SeverityBadge';
import type { Control } from '@/types/audit';

interface ResultInfoProps {
  control: Control;
}

export default function ResultInfo({ control }: ResultInfoProps) {
  const vc = verdictColor(control.verdict);
  const controlId = getControlId(control.title);
  const titleText = controlId
    ? control.title.replace(/^[\d.]+|^A\.\d+/, '').replace(/^\s*—?\s*/, '')
    : control.title;

  return (
    <div className="space-y-4">
      {/* Badges top-right */}
      <div className="flex items-center justify-end gap-2">
        <SeverityBadge severity={control.severity} />
        <StatusBadge verdict={control.verdict} size="md" />
      </div>

      {/* Title */}
      <div>
        {controlId && (
          <code className="text-xs font-mono text-muted-foreground">{controlId}</code>
        )}
        <h2 className="text-lg font-semibold text-foreground">{titleText}</h2>
        {control.section && (
          <span className="text-xs text-muted-foreground">{control.section}</span>
        )}
      </div>

      <hr className="border-border" />

      {/* Result card — colored by verdict */}
      <div className={cn("rounded-xl p-4 border", vc.bg, vc.border)}>
        <h3 className={cn("text-sm font-semibold mb-3", vc.text)}>Résultat du contrôle</h3>
        {control.expected && (
          <div className="mb-2">
            <span className="text-xs font-medium text-muted-foreground">Attendu</span>
            <p className="text-sm text-foreground mt-0.5">{control.expected}</p>
          </div>
        )}
        {control.observed && (
          <div>
            <span className="text-xs font-medium text-muted-foreground">Constaté</span>
            <p className="text-sm text-foreground mt-0.5">{control.observed}</p>
          </div>
        )}
      </div>

      {/* Remediation card (FAIL only) */}
      {control.verdict === 'FAIL' && (control.remediation || control.recommendation) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3">Remédiation</h3>
          {control.recommendation && (
            <p className="text-sm text-foreground mb-2">{control.recommendation}</p>
          )}
          {control.remediation && (
            <pre className="mt-2 rounded-lg bg-gray-900 p-3 text-xs text-gray-100 overflow-x-auto dark:bg-gray-950">
              <code>{control.remediation}</code>
            </pre>
          )}
        </div>
      )}

      {/* Reference card */}
      {control.ref && (
        <div className="rounded-xl border border-border bg-gray-50 p-4 dark:bg-gray-800/30">
          <h3 className="text-sm font-semibold text-foreground mb-3">Référentiel</h3>
          <div className="space-y-2 text-sm">
            {control.ref.standard && (
              <div>
                <span className="font-medium text-muted-foreground">Standard : </span>
                <span className="text-foreground">{control.ref.standard}</span>
              </div>
            )}
            {control.ref.source && (
              <div>
                <span className="font-medium text-muted-foreground">Source : </span>
                <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{control.ref.source}</code>
              </div>
            )}
            {control.ref.critere && (
              <div>
                <span className="font-medium text-muted-foreground">Critère : </span>
                <span className="text-foreground">{control.ref.critere}</span>
              </div>
            )}
            {control.ref.recommandation && (
              <div>
                <span className="font-medium text-muted-foreground">Recommandation : </span>
                <span className="text-foreground">{control.ref.recommandation}</span>
              </div>
            )}
            {control.ref.verification && (
              <div>
                <span className="font-medium text-muted-foreground">Vérification : </span>
                <span className="text-foreground">{control.ref.verification}</span>
              </div>
            )}
            {control.ref.note && (
              <div>
                <span className="font-medium text-muted-foreground">Note : </span>
                <span className="text-foreground">{control.ref.note}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
