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
import { isOwedObligation } from '@/features/payments/policy';
import { formatPrice } from '@/utils/format';

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
      value: meta.money ? formatPrice(value, currency) : String(value),
    });
  }
  return stats;
}

// ────── Dashboard-shaped helpers (web parity) ──────────────────────────────
//
// Mirrors the salo-run Client/Coordinator dashboards (pages/client/home.tsx
// + pages/event-coordinator/home.tsx). Each endpoint is fetched as-is and
// mapped defensively so the mobile home can rebuild the same hero + KPI
// grid + pending-payments banner + recent activity/transactions sections.

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export type CustomerAnalytics = {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  totalBookings: number;
  totalSpent: number;
  pendingAmount: number;
  gifts: number;
  totalPhotos: number;
  totalVideos: number;
  bookmarkedPhotographers: number;
  unreadNotifications: number;
};

export type CoordinatorAnalytics = {
  totalCustomers: number;
  totalPhotographers: number;
  totalEvents: number;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  pendingProfileReviews: number;
  activeStreams: number;
  totalNotifications: number;
  unreadContactMessages: number;
};

function defaultCustomerAnalytics(): CustomerAnalytics {
  return {
    totalEvents: 0,
    upcomingEvents: 0,
    completedEvents: 0,
    cancelledEvents: 0,
    totalBookings: 0,
    totalSpent: 0,
    pendingAmount: 0,
    gifts: 0,
    totalPhotos: 0,
    totalVideos: 0,
    bookmarkedPhotographers: 0,
    unreadNotifications: 0,
  };
}

function defaultCoordinatorAnalytics(): CoordinatorAnalytics {
  return {
    totalCustomers: 0,
    totalPhotographers: 0,
    totalEvents: 0,
    totalRevenue: 0,
    totalPaid: 0,
    totalPending: 0,
    pendingProfileReviews: 0,
    activeStreams: 0,
    totalNotifications: 0,
    unreadContactMessages: 0,
  };
}

export async function getCustomerAnalytics(): Promise<CustomerAnalytics> {
  const res = await api.get<ApiEnvelope<Raw>>('/customer/analytics');
  const d = (res?.data ?? {}) as Raw;
  const def = defaultCustomerAnalytics();
  return {
    totalEvents: num(d.totalEvents) ?? def.totalEvents,
    upcomingEvents: num(d.upcomingEvents) ?? def.upcomingEvents,
    completedEvents: num(d.completedEvents) ?? def.completedEvents,
    cancelledEvents: num(d.cancelledEvents) ?? def.cancelledEvents,
    totalBookings: num(d.totalBookings) ?? def.totalBookings,
    totalSpent: num(d.totalSpent) ?? def.totalSpent,
    pendingAmount: num(d.pendingAmount) ?? def.pendingAmount,
    gifts: num(d.gifts) ?? def.gifts,
    totalPhotos: num(d.totalPhotos) ?? def.totalPhotos,
    totalVideos: num(d.totalVideos) ?? def.totalVideos,
    bookmarkedPhotographers: num(d.bookmarkedPhotographers) ?? def.bookmarkedPhotographers,
    unreadNotifications: num(d.unreadNotifications) ?? def.unreadNotifications,
  };
}

export type PhotographerAnalytics = {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  totalClients: number;
  totalBookings: number;
  totalEarnings: number;
  totalTips: number;
  pendingPayments: number;
  bonuses: number;
  averageRating: number;
  totalPhotosUploaded: number;
  unreadNotifications: number;
};

function defaultPhotographerAnalytics(): PhotographerAnalytics {
  return {
    totalEvents: 0,
    upcomingEvents: 0,
    completedEvents: 0,
    totalClients: 0,
    totalBookings: 0,
    totalEarnings: 0,
    totalTips: 0,
    pendingPayments: 0,
    bonuses: 0,
    averageRating: 0,
    totalPhotosUploaded: 0,
    unreadNotifications: 0,
  };
}

export async function getPhotographerAnalytics(): Promise<PhotographerAnalytics> {
  const res = await api.get<ApiEnvelope<Raw>>('/photographer/analytics');
  const d = (res?.data ?? {}) as Raw;
  const def = defaultPhotographerAnalytics();
  return {
    totalEvents: num(d.totalEvents) ?? def.totalEvents,
    upcomingEvents: num(d.upcomingEvents) ?? def.upcomingEvents,
    completedEvents: num(d.completedEvents) ?? def.completedEvents,
    totalClients: num(d.totalClients) ?? def.totalClients,
    totalBookings: num(d.totalBookings) ?? def.totalBookings,
    totalEarnings: num(d.totalEarnings) ?? def.totalEarnings,
    totalTips: num(d.totalTips) ?? def.totalTips,
    pendingPayments: num(d.pendingPayments) ?? def.pendingPayments,
    bonuses: num(d.bonuses) ?? def.bonuses,
    averageRating: num(d.averageRating) ?? def.averageRating,
    totalPhotosUploaded: num(d.totalPhotosUploaded) ?? def.totalPhotosUploaded,
    unreadNotifications: num(d.unreadNotifications) ?? def.unreadNotifications,
  };
}

export async function getPhotographerTrends(
  period: AnalyticsPeriod,
  from?: string,
  to?: string,
): Promise<TrendsMap> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/photographer/analytics/trends?${trendsQuery(period, from, to)}`,
  );
  return mapTrends(res?.data as Raw);
}

export async function getCoordinatorAnalytics(): Promise<CoordinatorAnalytics> {
  const res = await api.get<ApiEnvelope<Raw>>('/coordinator/analytics');
  const d = (res?.data ?? {}) as Raw;
  const def = defaultCoordinatorAnalytics();
  return {
    totalCustomers: num(d.totalCustomers) ?? def.totalCustomers,
    totalPhotographers: num(d.totalPhotographers) ?? def.totalPhotographers,
    totalEvents: num(d.totalEvents) ?? def.totalEvents,
    totalRevenue: num(d.totalRevenue) ?? def.totalRevenue,
    totalPaid: num(d.totalPaid) ?? def.totalPaid,
    totalPending: num(d.totalPending) ?? def.totalPending,
    pendingProfileReviews: num(d.pendingProfileReviews) ?? def.pendingProfileReviews,
    activeStreams: num(d.activeStreams) ?? def.activeStreams,
    totalNotifications: num(d.totalNotifications) ?? def.totalNotifications,
    unreadContactMessages: num(d.unreadContactMessages) ?? def.unreadContactMessages,
  };
}

// ────── Trends (% change per stat for the selected period) ────────────────

export type Trend = { percentage: string; direction: 'up' | 'down'; value?: number };
export type TrendsMap = Record<string, Trend>;

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'custom';

function trendsQuery(period: AnalyticsPeriod, from?: string, to?: string): string {
  const qs = new URLSearchParams();
  qs.set('period', period);
  if (period === 'custom' && from && to) {
    qs.set('from', from);
    qs.set('to', to);
  }
  return qs.toString();
}

function mapTrends(raw: Raw | undefined | null): TrendsMap {
  const out: TrendsMap = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Raw;
    const pct = num(v.changePercent);
    const val = num(v.value);
    const item: Trend = {
      percentage: pct != null ? `${Math.abs(pct).toFixed(1)}%` : '0%',
      direction: v.trend === 'down' ? 'down' : 'up',
      ...(val != null ? { value: val } : {}),
    };
    out[key] = item;
  }

  // Cross-alias keys so both short ('events') and full ('totalEvents') are accessible
  if (out.pending && !out.totalPending) out.totalPending = out.pending;
  if (out.totalPending && !out.pending) out.pending = out.totalPending;

  if (out.events && !out.totalEvents) out.totalEvents = out.events;
  if (out.totalEvents && !out.events) out.events = out.totalEvents;

  if (out.photographers && !out.totalPhotographers) out.totalPhotographers = out.photographers;
  if (out.totalPhotographers && !out.photographers) out.photographers = out.totalPhotographers;

  if (out.totalRevenue && !out.revenue) out.revenue = out.totalRevenue;
  if (out.revenue && !out.totalRevenue) out.totalRevenue = out.revenue;

  if (out.clients && !out.totalCustomers) out.totalCustomers = out.clients;
  if (out.customers && !out.totalCustomers) out.totalCustomers = out.customers;
  if (out.totalCustomers && !out.clients) out.clients = out.totalCustomers;

  return out;
}

export async function getCustomerTrends(
  period: AnalyticsPeriod,
  from?: string,
  to?: string,
): Promise<TrendsMap> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/customer/analytics/trends?${trendsQuery(period, from, to)}`,
  );
  return mapTrends(res?.data as Raw);
}

export async function getCoordinatorTrends(
  period: AnalyticsPeriod,
  from?: string,
  to?: string,
): Promise<TrendsMap> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/coordinator/analytics/trends?${trendsQuery(period, from, to)}`,
  );
  return mapTrends(res?.data as Raw);
}

// ────── Pending payments banner (web parity) ─────────────────────────────

export type PendingPayment = {
  id: string;
  eventName: string;
  photographerName: string;
  photographerImage?: string;
  amount: number;
  paidAmount: number;
  dueDate?: string;
  status: 'pending' | 'failed' | 'partially_paid';
  /** BOOKING, STREAMING, TIP, … — gates whether it's payable in-app on Android. */
  paymentType?: string;
};

function mapPendingPayment(r: Raw): PendingPayment {
  const rawStatus = (str(r.status) ?? '').toUpperCase();
  const status: PendingPayment['status'] =
    rawStatus === 'FAILED'
      ? 'failed'
      : rawStatus === 'PARTIAL'
        ? 'partially_paid'
        : 'pending';
  return {
    id: String(r.id ?? ''),
    eventName: str(r.eventTitle) ?? str(r.eventName) ?? 'Event',
    photographerName: str(r.photographerName) ?? 'Photographer',
    photographerImage: str(r.photographerImage),
    amount: num(r.amountInUsd) ?? num(r.amount) ?? 0,
    paidAmount: num(r.paidAmountInUsd) ?? num(r.paidAmount) ?? 0,
    dueDate: str(r.dueDate),
    status,
    paymentType: str(r.paymentType),
  };
}

export async function getCustomerPendingPayments(): Promise<PendingPayment[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/customer/payments/pending');
  const data = Array.isArray(res?.data) ? res.data : [];
  // The endpoint returns every unsettled declaration on the user's events,
  // including viewers' unfinished tickets and gifts. Those are not owed.
  return data.map(mapPendingPayment).filter((p) => p.id && isOwedObligation(p.paymentType));
}

export async function getCoordinatorPendingPayments(): Promise<PendingPayment[]> {
  const res = await api.get<ApiEnvelope<Raw>>('/coordinator/payments?page=0&size=10');
  const d = (res?.data ?? {}) as Raw;
  const items: Raw[] = Array.isArray(d.content)
    ? (d.content as Raw[])
    : Array.isArray(d)
      ? (d as unknown as Raw[])
      : [];
  return items
    .filter((p) => {
      const s = (str(p.status) ?? '').toUpperCase();
      return s !== 'COMPLETED' && s !== 'SUCCESS';
    })
    .map(mapPendingPayment)
    .filter((p) => p.id && isOwedObligation(p.paymentType));
}

// ────── Recent activities + photographers (Client only) ───────────────────

export type RecentActivity = {
  id: string;
  type: string;
  title: string;
  message?: string;
  createdAt?: string;
};

export async function getCustomerRecentActivities(size = 6): Promise<RecentActivity[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(
    `/customer/analytics/recent-activities?size=${size}`,
  );
  const data = Array.isArray(res?.data) ? res.data : [];
  return data
    .map((r) => ({
      id: String(r.id ?? ''),
      type: str(r.type) ?? 'Activity',
      title: str(r.title) ?? str(r.message) ?? 'Activity',
      message: str(r.message),
      createdAt: str(r.createdAt),
    }))
    .filter((a) => a.id);
}

export type RecentPhotographer = {
  id: string;
  name: string;
  event: string;
  status: 'In Progress' | 'Completed' | 'Pending';
  avatar?: string;
};

export async function getCustomerPhotographers(size = 5): Promise<RecentPhotographer[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(
    `/customer/analytics/photographers?size=${size}`,
  );
  const data = Array.isArray(res?.data) ? res.data : [];
  return data
    .map((r) => ({
      id: String(r.id ?? ''),
      name: str(r.name) ?? 'Photographer',
      event: str(r.event) ?? 'Event',
      status: (str(r.status) as RecentPhotographer['status']) ?? 'Pending',
      avatar: str(r.avatar),
    }))
    .filter((p) => p.id);
}

// ────── Recent Payments (Client only) ────────────────────────────────────────

export type RecentPayment = {
  id: string;
  name: string;
  type: 'Pending' | 'Partially paid' | 'Failed';
  amount: number;
  avatar?: string;
};

export async function getCustomerRecentPayments(size = 5): Promise<RecentPayment[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(
    `/customer/analytics/recent-payments?size=${size}`,
  );
  const data = Array.isArray(res?.data) ? res.data : [];
  return data
    .filter((p) => {
      const s = (str(p.status) ?? '').toUpperCase();
      return s !== 'COMPLETED' && s !== 'SUCCESS';
    })
    .slice(0, size)
    .map((p) => {
      const s = (str(p.status) ?? '').toUpperCase();
      return {
        id: String(p.id ?? ''),
        name: str(p.photographerName) ?? 'Payment',
        type: (s === 'PARTIAL' ? 'Partially paid' : s === 'FAILED' ? 'Failed' : 'Pending') as RecentPayment['type'],
        amount: num(p.amountInUsd) ?? num(p.amount) ?? 0,
        avatar: str(p.photographerImage),
      };
    })
    .filter((p) => p.id);
}

// ────── Performance chart (Client only) ───────────────────────────────────────

export type PerformancePoint = { day: string; value1: number; value2: number };

export async function getCustomerPerformance(
  period: AnalyticsPeriod,
  from?: string,
  to?: string,
): Promise<PerformancePoint[]> {
  const qs = new URLSearchParams();
  if (period === 'custom' && from && to) {
    qs.set('period', 'custom');
    qs.set('from', from);
    qs.set('to', to);
  } else {
    qs.set('period', period === 'custom' ? 'week' : period);
  }
  const res = await api.get<ApiEnvelope<Raw[]>>(`/customer/analytics/performance?${qs}`);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map((d) => ({
    day: str(d.day) ?? '',
    value1: num(d.value1) ?? 0,
    value2: num(d.value2) ?? 0,
  }));
}

// ────── Coordinator extras ─────────────────────────────────────────────────

export type CoordinatorPhotographer = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  totalEvents: number;
  status: string;
};

export async function getCoordinatorPerformance(
  period: AnalyticsPeriod,
  from?: string,
  to?: string,
): Promise<PerformancePoint[]> {
  const qs = new URLSearchParams();
  if (period === 'custom' && from && to) {
    qs.set('period', 'custom');
    qs.set('from', from);
    qs.set('to', to);
  } else {
    qs.set('period', period === 'custom' ? 'week' : period);
  }
  const res = await api.get<ApiEnvelope<Raw[]>>(`/coordinator/analytics/performance?${qs}`);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map((d) => ({
    day: str(d.day) ?? '',
    value1: num(d.value1) ?? 0,
    value2: num(d.value2) ?? 0,
  }));
}

export async function getCoordinatorPhotographers(size = 5): Promise<CoordinatorPhotographer[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(`/coordinator/photographers?page=0&size=${size}`);
  const raw = res?.data;
  const items: Raw[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.content)
      ? (raw as any).content
      : [];
  return items.map((r) => ({
    id: String(r.id ?? ''),
    name: str(r.name) ?? str(r.firstName) ?? 'Photographer',
    email: str(r.email),
    avatar: str(r.avatar) ?? str(r.profilePicture),
    totalEvents: num(r.totalEvents) ?? 0,
    status: str(r.status) ?? 'Active',
  })).filter((p) => p.id);
}

export type DashboardActivity = {
  id: string;
  title: string;
  type: string;
  createdAt?: string;
};

export async function getCoordinatorRecentActivities(size = 6): Promise<DashboardActivity[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(`/coordinator/notifications?page=0&size=${size}`);
  const raw = res?.data;
  const items: Raw[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.content)
      ? (raw as any).content
      : [];
  return items.map((r) => ({
    id: String(r.id ?? ''),
    title: str(r.title) ?? str(r.message) ?? 'Notification',
    type: str(r.type) ?? 'Notification',
    createdAt: str(r.createdAt),
  })).filter((a) => a.id);
}

// ────── Photographer extras ────────────────────────────────────────────────

export type PhotographerClient = {
  id: string;
  name: string;
  avatar?: string;
  totalEvents: number;
  lastEvent?: string;
};

export async function getPhotographerPerformance(
  period: AnalyticsPeriod,
  from?: string,
  to?: string,
): Promise<PerformancePoint[]> {
  const qs = new URLSearchParams();
  if (period === 'custom' && from && to) {
    qs.set('period', 'custom');
    qs.set('from', from);
    qs.set('to', to);
  } else {
    qs.set('period', period === 'custom' ? 'week' : period);
  }
  const res = await api.get<ApiEnvelope<Raw[]>>(`/photographer/performance?${qs}`);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map((d) => ({
    day: str(d.day) ?? '',
    value1: num(d.value1) ?? 0,
    value2: num(d.value2) ?? 0,
  }));
}

export async function getPhotographerClients(size = 5): Promise<PhotographerClient[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(`/photographer/clients?page=0&size=${size}`);
  const raw = res?.data;
  const items: Raw[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.content)
      ? (raw as any).content
      : [];
  return items.map((r) => ({
    id: String(r.id ?? ''),
    name: [str(r.firstName), str(r.lastName)].filter(Boolean).join(' ') || str(r.name) || 'Client',
    avatar: str(r.avatar) ?? str(r.profilePicture),
    totalEvents: num(r.totalEvents) ?? 0,
    lastEvent: str(r.lastEvent) ?? str(r.lastEventDate),
  })).filter((c) => c.id);
}

export type RecentTransaction = {
  id: string;
  eventName: string;
  amount: number;
  status: string;
  createdAt?: string;
};

export function cleanTransactionTitle(raw?: string): string {
  if (!raw) return 'Event';
  return raw
    .replace(/\s*\(?\d+(\.\d+)?%\)?/gi, '')
    .replace(/\s*-\s*$/, '')
    .replace(/^\s*-\s*/, '')
    .trim() || 'Event';
}

export function cleanTransactionStatus(raw?: string): string {
  if (!raw) return 'Pending';
  return raw
    .replace(/\s*\(?\d+(\.\d+)?%\)?/gi, '')
    .replace(/\s*-\s*$/, '')
    .trim() || 'Pending';
}

export async function getPhotographerRecentTransactions(size = 5): Promise<RecentTransaction[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(`/photographer/transactions?page=0&size=${size}`);
  const raw = res?.data;
  const items: Raw[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.content)
      ? (raw as any).content
      : [];
  return items.map((r) => {
    const rawTitle = str(r.eventTitle) ?? str(r.eventName) ?? str(r.description) ?? 'Event';
    const rawStatus = str(r.status) ?? 'Pending';
    return {
      id: String(r.id ?? ''),
      eventName: cleanTransactionTitle(rawTitle),
      amount: num(r.amountInUsd) ?? num(r.amount) ?? 0,
      status: cleanTransactionStatus(rawStatus),
      createdAt: str(r.createdAt),
    };
  }).filter((t) => t.id);
}

