import type { AuditReport } from '@/types/audit';

// The audit data is injected into the HTML by the Node.js script via a <script> tag
// that sets window.__AUDIT_DATA__. This mirrors the Maester pattern where PowerShell
// replaces a marker in the compiled template with the real JSON data.
export const auditData: AuditReport = (window as unknown as { __AUDIT_DATA__: AuditReport }).__AUDIT_DATA__;
