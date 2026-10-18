/**
 * The three figures under a client's avatar, from the account the API returned.
 *
 * The old row drew `Events 0` and `Reviews 0` when those fields were simply absent, and a fixed `Status: Active` for
 * everyone. A missing count is a dash, not a zero, and the third figure is the identity verification the account
 * really has (or a dash when the API did not say).
 */
export type StatItem = { label: string; value: string };

const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** Whole words only: "pend" must not match inside "suspended". */
export function kycLabel(status?: string | null): string {
  const raw = (status ?? '').trim();
  if (!raw) return '—';
  const w = words(raw);
  const has = (...xs: string[]) => xs.some((x) => w.includes(x));
  if (has('not', 'unverified', 'none')) return 'Not verified';
  if (has('rejected', 'failed', 'declined', 'expired')) return 'Needs attention';
  if (has('pending', 'review', 'submitted', 'awaiting')) return 'In review';
  if (has('approved', 'verified')) return 'Verified';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function clientStats(u?: { completedEvents?: number | null; reviewsCount?: number | null; kycStatus?: string | null } | null): StatItem[] {
  const n = (v?: number | null) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '—');
  return [
    { label: 'Events', value: n(u?.completedEvents) },
    { label: 'Reviews', value: n(u?.reviewsCount) },
    { label: 'Identity', value: kycLabel(u?.kycStatus) },
  ];
}
