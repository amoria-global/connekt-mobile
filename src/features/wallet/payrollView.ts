import type { PayrollReport } from './api';

export type PayrollStat = { key: 'total' | 'paid' | 'pending'; label: string; value: number | null };

export type PayrollView = {
  /** The response carried none of the figures and no list: the report as a whole is unavailable, not empty. */
  unavailable: boolean;
  stats: PayrollStat[];
  /** The backend sent no transactions array, so the list is unknown (not "no earnings"). */
  listUnavailable: boolean;
  /** The backend sent an empty list: confirmed no earnings to list. */
  confirmedEmpty: boolean;
};

/** Decides what the earnings report may claim. A figure is only 0 when the backend sent 0. */
export function payrollView(r: PayrollReport): PayrollView {
  const stats: PayrollStat[] = [
    { key: 'total', label: 'Total', value: r.total },
    { key: 'paid', label: 'Paid', value: r.paid },
    { key: 'pending', label: 'Pending', value: r.pending },
  ];
  const noFigures = stats.every((s) => s.value == null);
  return {
    unavailable: noFigures && r.entries == null,
    stats,
    listUnavailable: r.entries == null,
    confirmedEmpty: r.entries != null && r.entries.length === 0,
  };
}
