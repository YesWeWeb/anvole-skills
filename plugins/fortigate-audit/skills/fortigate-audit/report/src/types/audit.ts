export type Verdict = 'PASS' | 'FAIL' | 'MANUAL' | 'N/A';

export interface Reference {
  standard: string;
  source: string;
  critere: string;
  attendu: string;
  recommandation: string;
  verification: string;
  note: string;
  refAnssi: string;
  severity: string;
  title: string;
  controlId: string;
}

export interface Control {
  title: string;
  verdict: Verdict;
  severity: string | null;
  section: string;
  expected: string;
  observed: string;
  remediation: string;
  recommendation: string;
  ref?: Reference;
}

export interface Section {
  name: string;
  id: string;
}

export interface PriorityItem {
  id: string;
  text: string;
}

export interface Priority {
  level: string;
  description: string;
  items: PriorityItem[];
}

export interface Summary {
  pass: number;
  fail: number;
  manual: number;
  na: number;
  total: number;
  score: number;
}

export interface AuditReport {
  title: string;
  deviceInfo: Record<string, string>;
  summary: Summary;
  sections: Section[];
  controls: Control[];
  priorities: Priority[];
  reportId: string;
  timestamp: string;
  sourceHash: string;
  remediationBlock: string;
}
