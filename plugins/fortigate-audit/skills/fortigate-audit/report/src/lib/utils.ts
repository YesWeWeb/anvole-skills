import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Verdict, Control } from '@/types/audit';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getControlId(title: string): string | null {
  const m = title.match(/^([\d.]+|A\.\d+)\s/);
  return m ? m[1] : null;
}

export function verdictColor(verdict: Verdict) {
  switch (verdict) {
    case 'PASS': return { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', color: '#10b981' };
    case 'FAIL': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800', color: '#f43f5e' };
    case 'MANUAL': return { bg: 'bg-gray-100 dark:bg-gray-800/50', text: 'text-gray-700 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700', color: '#6b7280' };
    case 'N/A': return { bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', color: '#94a3b8' };
  }
}

export function severityColor(severity: string | null) {
  switch (severity?.toLowerCase()) {
    case 'critical': return { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400' };
    case 'high': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' };
    case 'medium': return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' };
    case 'low': return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' };
    default: return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' };
  }
}

export const severityOrder: Record<string, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

export const statusOrder: Record<string, number> = {
  FAIL: 4, MANUAL: 3, PASS: 2, 'N/A': 1,
};

export function compareControlIds(a: string, b: string): number {
  const partsA = a.split('.').map(p => /^\d+$/.test(p) ? parseInt(p) : p);
  const partsB = b.split('.').map(p => /^\d+$/.test(p) ? parseInt(p) : p);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const pa = partsA[i] ?? 0;
    const pb = partsB[i] ?? 0;
    if (typeof pa === 'number' && typeof pb === 'number') {
      if (pa !== pb) return pa - pb;
    } else {
      const cmp = String(pa).localeCompare(String(pb));
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export function getCategoryStats(controls: Control[]) {
  const categories: Record<string, { pass: number; fail: number; manual: number; na: number; total: number }> = {};
  for (const c of controls) {
    const cat = c.section || 'Autre';
    if (!categories[cat]) categories[cat] = { pass: 0, fail: 0, manual: 0, na: 0, total: 0 };
    const key = c.verdict === 'N/A' ? 'na' : c.verdict.toLowerCase() as 'pass' | 'fail' | 'manual';
    categories[cat][key]++;
    categories[cat].total++;
  }
  return categories;
}
