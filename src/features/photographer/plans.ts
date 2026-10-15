/**
 * Photographer goals ("plans"), mirroring the web dashboard against the same
 * `/photographer/plans` CRUD. Nothing is kept locally: a goal exists only once
 * the server has accepted it, and the list always comes back from the server.
 *
 * Contract (PhotographerDashboardController): targets are numbers sent as
 * strings or numbers, `targetClients` must be a whole number (the server parses
 * an Integer), `timePeriod` is today | week | month | custom and custom needs
 * both dates. Targets carry no currency on the server; the web writes them as
 * dollars, so they are shown as USD here.
 */
import { api, requireOk } from '@/api/client';

export type PlanPeriod = 'today' | 'week' | 'month' | 'custom';

export type Plan = {
  id: string;
  name: string;
  timePeriod: PlanPeriod;
  customStartDate?: string;
  customEndDate?: string;
  targetEarnings: number;
  targetPending: number;
  targetClients: number;
  targetBonuses: number;
  targetRatings: number;
};

/** What the form edits: everything as text so a half-typed number is not lost. */
export type PlanDraft = {
  name: string;
  timePeriod: PlanPeriod;
  customStartDate: string;
  customEndDate: string;
  targetEarnings: string;
  targetPending: string;
  targetClients: string;
  targetBonuses: string;
  targetRatings: string;
};

export const PLAN_PERIODS: readonly { key: PlanPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom' },
];

export const emptyDraft = (): PlanDraft => ({
  name: '',
  timePeriod: 'month',
  customStartDate: '',
  customEndDate: '',
  targetEarnings: '',
  targetPending: '',
  targetClients: '',
  targetBonuses: '',
  targetRatings: '',
});

const isPeriod = (v: unknown): v is PlanPeriod => v === 'today' || v === 'week' || v === 'month' || v === 'custom';
const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : 0;
};

export function toPlan(r: Record<string, unknown>): Plan | null {
  const id = typeof r.id === 'string' ? r.id : r.id != null ? String(r.id) : '';
  if (!id) return null;
  return {
    id,
    name: typeof r.name === 'string' ? r.name : '',
    timePeriod: isPeriod(r.timePeriod) ? r.timePeriod : 'week',
    customStartDate: typeof r.customStartDate === 'string' ? r.customStartDate.slice(0, 10) : undefined,
    customEndDate: typeof r.customEndDate === 'string' ? r.customEndDate.slice(0, 10) : undefined,
    targetEarnings: n(r.targetEarnings),
    targetPending: n(r.targetPending),
    targetClients: n(r.targetClients),
    targetBonuses: n(r.targetBonuses),
    targetRatings: n(r.targetRatings),
  };
}

export function draftOf(p: Plan): PlanDraft {
  const t = (v: number) => (v > 0 ? String(v) : '');
  return {
    name: p.name,
    timePeriod: p.timePeriod,
    customStartDate: p.customStartDate ?? '',
    customEndDate: p.customEndDate ?? '',
    targetEarnings: t(p.targetEarnings),
    targetPending: t(p.targetPending),
    targetClients: t(p.targetClients),
    targetBonuses: t(p.targetBonuses),
    targetRatings: t(p.targetRatings),
  };
}

export type DraftErrors = Partial<Record<keyof PlanDraft, string>>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRealDay = (s: string) => {
  if (!DAY.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

/** Mirrors what the server accepts, plus the web's own rule (name and earnings target required). */
export function validateDraft(d: PlanDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = 'Give the goal a name.';
  else if (d.name.trim().length > 100) e.name = 'Keep the name under 100 characters.';

  const amount = (key: 'targetEarnings' | 'targetPending' | 'targetBonuses', required: boolean) => {
    const raw = d[key].trim();
    if (!raw) {
      if (required) e[key] = 'Enter a target amount.';
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) e[key] = 'Use a number, 0 or more.';
    else if (required && v === 0) e[key] = 'Enter a target above 0.';
  };
  amount('targetEarnings', true);
  amount('targetPending', false);
  amount('targetBonuses', false);

  const clients = d.targetClients.trim();
  if (clients && !/^\d+$/.test(clients)) e.targetClients = 'Use a whole number.';

  const rating = d.targetRatings.trim();
  if (rating) {
    const v = Number(rating);
    if (!Number.isFinite(v) || v < 0 || v > 5) e.targetRatings = 'Use a rating from 0 to 5.';
  }

  if (d.timePeriod === 'custom') {
    if (!isRealDay(d.customStartDate.trim())) e.customStartDate = 'Use YYYY-MM-DD.';
    if (!isRealDay(d.customEndDate.trim())) e.customEndDate = 'Use YYYY-MM-DD.';
    if (!e.customStartDate && !e.customEndDate && d.customEndDate.trim() < d.customStartDate.trim()) {
      e.customEndDate = 'The end cannot be before the start.';
    }
  }
  return e;
}

function bodyOf(d: PlanDraft) {
  const custom = d.timePeriod === 'custom';
  const num = (s: string) => (s.trim() ? s.trim() : '0');
  return {
    name: d.name.trim(),
    timePeriod: d.timePeriod,
    customStartDate: custom ? d.customStartDate.trim() : null,
    customEndDate: custom ? d.customEndDate.trim() : null,
    targetEarnings: num(d.targetEarnings),
    targetPending: num(d.targetPending),
    targetClients: num(d.targetClients),
    targetBonuses: num(d.targetBonuses),
    targetRatings: num(d.targetRatings),
  };
}

export async function listPlans(): Promise<Plan[]> {
  const res = await api.getOk<{ data?: unknown }>('/photographer/plans');
  const raw = Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
  return raw.map(toPlan).filter((p): p is Plan => p !== null);
}

export async function createPlan(d: PlanDraft): Promise<void> {
  requireOk(await api.post('/photographer/plans', bodyOf(d)));
}

export async function updatePlan(id: string, d: PlanDraft): Promise<void> {
  requireOk(await api.put(`/photographer/plans/${encodeURIComponent(id)}`, bodyOf(d)));
}

export async function deletePlan(id: string): Promise<void> {
  requireOk(await api.delete(`/photographer/plans/${encodeURIComponent(id)}`));
}

/** "Mar 3 to Mar 9" style label for a custom range, else the period name. */
export function periodLabel(p: Pick<Plan, 'timePeriod' | 'customStartDate' | 'customEndDate'>): string {
  if (p.timePeriod === 'custom') return `${p.customStartDate ?? '?'} to ${p.customEndDate ?? '?'}`;
  return { today: 'Today', week: 'This week', month: 'This month' }[p.timePeriod];
}
