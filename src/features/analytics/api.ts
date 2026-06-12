/**
 * Role analytics dashboards.
 * - Client:       GET /api/remote/customer/analytics
 * - Photographer: GET /api/remote/photographer/analytics
 * - Coordinator:  GET /api/remote/coordinator/analytics
 * The shape varies by role, so we map known numeric keys defensively into
 * labelled stat cards.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import { formatMoney } from '@/utils/format';

export type AnalyticsStat = { key: string; label: string; value: string };

type Raw = Record<string, unknown>;

/** Known stat keys -> label + whether it's a money value. */
const STAT_LABELS: Record<string, { label: string; money?: boolean }> = {
  totalSpent: { label: 'Total spent', money: true },
  totalEarnings: { label: 'Total earnings', money: true },
  earnings: { label: 'Earnings', money: true },
  pendingAmount: { label: 'Pending', money: true },
  totalEvents: { label: 'Events' },
  events: { label: 'Events' },
  upcomingEvents: { label: 'Upcoming' },
  completedEvents: { label: 'Completed' },
  completed: { label: 'Completed' },
  pending: { label: 'Pending' },
  totalBookings: { label: 'Bookings' },
  bookings: { label: 'Bookings' },
  photographers: { label: 'Photographers' },
  totalClients: { label: 'Clients' },
  clients: { label: 'Clients' },
  totalPhotos: { label: 'Photos' },
  totalViews: { label: 'Views' },
  views: { label: 'Views' },
  averageRating: { label: 'Rating' },
  rating: { label: 'Rating' },
};

const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

export type AnalyticsRole = 'Client' | 'Photographer' | 'Coordinator' | 'Viewer';

export async function getAnalytics(role: AnalyticsRole, currency?: string): Promise<AnalyticsStat[]> {
  const path =
    role === 'Photographer'
      ? '/photographer/analytics'
      : role === 'Coordinator'
        ? '/coordinator/analytics'
        : '/customer/analytics';

  const res = await api.get<ApiEnvelope<Raw>>(path);
  const d = (res?.data ?? {}) as Raw;

  const stats: AnalyticsStat[] = [];
  for (const [key, meta] of Object.entries(STAT_LABELS)) {
    const value = num(d[key]);
    if (value == null) continue;
    stats.push({
      key,
      label: meta.label,
      value: meta.money ? formatMoney(value, currency) : String(value),
    });
  }
  return stats;
}
