/**
 * What a photobook's real backend status means on screen: its label key, tone and filter bucket, the one action that
 * matters now, the timeline and the source chips. Pure, so the list, the detail and the tests all agree.
 *
 * Backend statuses (PhotobookService): DRAFT, SENT_TO_PHOTOGRAPHER, PHOTOGRAPHER_EDITING, PENDING_PAYMENT, RESUBMITTED
 * (ready to review) and COMPLETED. A COMPLETED book the photographer closed (photographerDismissed) is "Closed by
 * photographer", not "Completed". There is no Published or Delivered status.
 */
import type { ChipTone } from '@/components/ui/StatusChip';
import type { Photobook } from './api';

/** Which side is looking: the book's owner (client, coordinator, or a photographer's own books) or the recipient. */
export type Shelf = 'mine' | 'received';
export type Bucket = 'progress' | 'needs' | 'done';
export type FilterKey = 'all' | Bucket;

export type StatusKey =
  | 'st_draft'
  | 'st_with'
  | 'st_editing'
  | 'st_pay'
  | 'st_review'
  | 'st_done'
  | 'st_closed'
  | 'st_new'
  | 'st_changes'
  | 'st_wait_pay'
  | 'st_wait_review';

export type StatusInfo = { key: StatusKey; tone: ChipTone; bucket: Bucket; raw?: string };

type StatusFields = Pick<Photobook, 'status' | 'closedByPhotographer' | 'changeRequestedAt'>;

export function statusInfo(b: StatusFields, shelf: Shelf = 'mine'): StatusInfo {
  const s = (b.status ?? '').toUpperCase();
  if (s === 'COMPLETED') {
    return b.closedByPhotographer
      ? { key: 'st_closed', tone: 'neutral', bucket: 'done' }
      : { key: 'st_done', tone: 'success', bucket: 'done' };
  }
  if (shelf === 'received') {
    switch (s) {
      case 'SENT_TO_PHOTOGRAPHER':
        return b.changeRequestedAt
          ? { key: 'st_changes', tone: 'accent', bucket: 'needs' }
          : { key: 'st_new', tone: 'accent', bucket: 'needs' };
      case 'PHOTOGRAPHER_EDITING':
        return { key: 'st_editing', tone: 'primary', bucket: 'progress' };
      case 'PENDING_PAYMENT':
        return { key: 'st_wait_pay', tone: 'neutral', bucket: 'progress' };
      case 'RESUBMITTED':
        return { key: 'st_wait_review', tone: 'neutral', bucket: 'progress' };
      default:
        return { key: 'st_draft', tone: 'neutral', bucket: 'progress', raw: b.status };
    }
  }
  switch (s) {
    case 'DRAFT':
      return { key: 'st_draft', tone: 'neutral', bucket: 'progress' };
    case 'SENT_TO_PHOTOGRAPHER':
      return { key: 'st_with', tone: 'primary', bucket: 'progress' };
    case 'PHOTOGRAPHER_EDITING':
      return { key: 'st_editing', tone: 'primary', bucket: 'progress' };
    case 'PENDING_PAYMENT':
      return { key: 'st_pay', tone: 'pending', bucket: 'needs' };
    case 'RESUBMITTED':
      return { key: 'st_review', tone: 'accent', bucket: 'needs' };
    default:
      return { key: 'st_draft', tone: 'neutral', bucket: 'progress', raw: b.status };
  }
}

export function filterBooks<T extends StatusFields & { name: string; description?: string; photographerName?: string; senderName?: string }>(
  books: T[],
  shelf: Shelf,
  filter: FilterKey,
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return books.filter((b) => {
    if (filter !== 'all' && statusInfo(b, shelf).bucket !== filter) return false;
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      (b.description ?? '').toLowerCase().includes(q) ||
      (b.photographerName ?? '').toLowerCase().includes(q) ||
      (b.senderName ?? '').toLowerCase().includes(q)
    );
  });
}

export function bucketCounts(books: StatusFields[], shelf: Shelf): Record<FilterKey, number> {
  const c: Record<FilterKey, number> = { all: books.length, progress: 0, needs: 0, done: 0 };
  for (const b of books) c[statusInfo(b, shelf).bucket] += 1;
  return c;
}

// Source chips

export type SourceKey = 'event' | 'free' | 'purchased' | 'content' | 'mine';
const SOURCE_ORDER: SourceKey[] = ['event', 'free', 'purchased', 'content', 'mine'];
export const SOURCE_TONE: Record<SourceKey, ChipTone> = {
  event: 'primary',
  free: 'success',
  purchased: 'pending',
  content: 'neutral',
  mine: 'neutral',
};

/** Every source present in the book, in a stable order. A book with no photos shows no chips. */
export function sourcesOf(b: Pick<Photobook, 'sources' | 'sourceType'>): SourceKey[] {
  const raw = (b.sources && b.sources.length ? b.sources : b.sourceType ? [b.sourceType] : []).map((s) => s.toLowerCase());
  return SOURCE_ORDER.filter((k) => raw.includes(k));
}

// The one action

export type NextAction = 'send' | 'pay' | 'review' | 'edit' | 'resubmit' | 'wait' | 'none';

/**
 * The single thing this person can do now. Owner: send a draft, pay extras, review. Photographer: edit and send back
 * (a new or change-requested book is "edit", a book already being edited is "resubmit"). Everything else is waiting.
 */
export function nextAction(b: Pick<Photobook, 'status'>, shelf: Shelf, hasPhotos: boolean): NextAction {
  const s = (b.status ?? '').toUpperCase();
  if (s === 'COMPLETED') return 'none';
  if (shelf === 'received') {
    if (s === 'SENT_TO_PHOTOGRAPHER') return 'edit';
    if (s === 'PHOTOGRAPHER_EDITING') return 'resubmit';
    return 'wait';
  }
  if (s === 'DRAFT') return hasPhotos ? 'send' : 'none';
  if (s === 'PENDING_PAYMENT') return 'pay';
  if (s === 'RESUBMITTED') return 'review';
  return 'wait';
}

// Timeline

export type TimelineKey = 'tl_created' | 'tl_sent' | 'tl_edited' | 'tl_payment' | 'tl_review' | 'tl_done' | 'tl_closed';
export type TimelineStep = { key: TimelineKey; state: 'done' | 'current' | 'todo'; date?: string };

const ORDER: Record<string, number> = {
  DRAFT: 0,
  SENT_TO_PHOTOGRAPHER: 1,
  PHOTOGRAPHER_EDITING: 2,
  PENDING_PAYMENT: 3,
  RESUBMITTED: 4,
  COMPLETED: 5,
};

/** Created, Sent, Edited, Payment (only when extras apply), Review, then Completed or Closed by photographer. */
export function timelineOf(b: Photobook & { extraPhotosAmount?: number }): TimelineStep[] {
  const s = (b.status ?? '').toUpperCase();
  const at = ORDER[s] ?? 0;
  const withPayment = (b.extraPhotosAmount ?? 0) > 0 || s === 'PENDING_PAYMENT';
  const closed = !!b.closedByPhotographer;
  const mk = (key: TimelineKey, step: number, date?: string): TimelineStep => ({
    key,
    date,
    state: s === 'COMPLETED' || step < at ? 'done' : step === at ? 'current' : 'todo',
  });
  const steps: TimelineStep[] = [
    mk('tl_created', -1, b.createdAt),
    mk('tl_sent', 1, b.sentAt),
    mk('tl_edited', 2, b.editedAt),
  ];
  if (withPayment) steps.push(mk('tl_payment', 3));
  steps.push(mk('tl_review', 4, b.resubmittedAt));
  steps.push({
    key: closed ? 'tl_closed' : 'tl_done',
    date: b.completedAt,
    state: s === 'COMPLETED' ? 'done' : 'todo',
  });
  // A draft that was never sent: Created is done, Sent is the current step.
  if (s === 'DRAFT') steps[0].state = 'done';
  // A book sent back with a note re-opens the editing step.
  if (s === 'SENT_TO_PHOTOGRAPHER' && b.changeRequestedAt) {
    const edited = steps.find((x) => x.key === 'tl_edited');
    if (edited) edited.state = 'current';
  }
  return steps;
}

/** Does this source need a lock note in the picker (an unbought paid or priced photo is never shown)? */
export function isPricedSource(a: { priced?: boolean; sourceType: string }): boolean {
  return !!a.priced || a.sourceType === 'purchased';
}
