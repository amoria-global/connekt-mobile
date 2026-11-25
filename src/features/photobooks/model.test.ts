import { bucketCounts, filterBooks, nextAction, sourcesOf, statusInfo, timelineOf } from './model';
import { PHOTOBOOK_COPY_KEYS, PHOTOBOOK_DRAFTED, pbCopy, photoCountLabel, type CopyKey } from './copy';

const b = (status: string, extra: Record<string, unknown> = {}) => ({ id: 'x', name: 'Book', status, ...extra });

describe('statuses use the real backend names', () => {
  it.each([
    ['DRAFT', 'st_draft', 'progress'],
    ['SENT_TO_PHOTOGRAPHER', 'st_with', 'progress'],
    ['PHOTOGRAPHER_EDITING', 'st_editing', 'progress'],
    ['PENDING_PAYMENT', 'st_pay', 'needs'],
    ['RESUBMITTED', 'st_review', 'needs'],
    ['COMPLETED', 'st_done', 'done'],
  ])('%s is %s in %s', (status, key, bucket) => {
    expect(statusInfo(b(status))).toMatchObject({ key, bucket });
  });

  it('a book closed by the photographer is not shown as Completed', () => {
    expect(statusInfo(b('COMPLETED', { closedByPhotographer: true }))).toMatchObject({ key: 'st_closed', bucket: 'done' });
  });

  it('the photographer sees new and changes-requested books under Needs you', () => {
    expect(statusInfo(b('SENT_TO_PHOTOGRAPHER'), 'received')).toMatchObject({ key: 'st_new', bucket: 'needs' });
    expect(statusInfo(b('SENT_TO_PHOTOGRAPHER', { changeRequestedAt: '2026-11-25' }), 'received')).toMatchObject({ key: 'st_changes', bucket: 'needs' });
    expect(statusInfo(b('PENDING_PAYMENT'), 'received').bucket).toBe('progress');
  });

  it('there is no Published or Delivered status, and an unknown one keeps its own text', () => {
    expect(statusInfo(b('SENT'))).toMatchObject({ raw: 'SENT', bucket: 'progress' });
    expect(PHOTOBOOK_COPY_KEYS.join(' ')).not.toMatch(/deliver|publish/i);
  });
});

describe('filters and counts', () => {
  const books = [b('DRAFT'), b('PENDING_PAYMENT', { name: 'Kigali' }), b('RESUBMITTED'), b('COMPLETED')];
  it('counts each bucket', () => {
    expect(bucketCounts(books, 'mine')).toEqual({ all: 4, progress: 1, needs: 2, done: 1 });
  });
  it('filters by bucket and by title', () => {
    expect(filterBooks(books, 'mine', 'needs', '')).toHaveLength(2);
    expect(filterBooks(books, 'mine', 'all', 'kigali')).toHaveLength(1);
    expect(filterBooks(books, 'mine', 'done', 'kigali')).toHaveLength(0);
  });
});

describe('the one action', () => {
  it('owner', () => {
    expect(nextAction({ status: 'DRAFT' }, 'mine', true)).toBe('send');
    expect(nextAction({ status: 'DRAFT' }, 'mine', false)).toBe('none');
    expect(nextAction({ status: 'PENDING_PAYMENT' }, 'mine', true)).toBe('pay');
    expect(nextAction({ status: 'RESUBMITTED' }, 'mine', true)).toBe('review');
    expect(nextAction({ status: 'SENT_TO_PHOTOGRAPHER' }, 'mine', true)).toBe('wait');
    expect(nextAction({ status: 'COMPLETED' }, 'mine', true)).toBe('none');
  });
  it('photographer', () => {
    expect(nextAction({ status: 'SENT_TO_PHOTOGRAPHER' }, 'received', true)).toBe('edit');
    expect(nextAction({ status: 'PHOTOGRAPHER_EDITING' }, 'received', true)).toBe('resubmit');
    expect(nextAction({ status: 'RESUBMITTED' }, 'received', true)).toBe('wait');
  });
});

describe('sources and timeline', () => {
  it('lists every source present in a mixed book, in a stable order', () => {
    expect(sourcesOf({ sources: ['content', 'event', 'free'] })).toEqual(['event', 'free', 'content']);
    expect(sourcesOf({ sourceType: 'purchased' })).toEqual(['purchased']);
    expect(sourcesOf({})).toEqual([]);
  });
  it('shows Payment only when extras apply, and Closed for a closed book', () => {
    expect(timelineOf(b('RESUBMITTED')).map((s) => s.key)).toEqual(['tl_created', 'tl_sent', 'tl_edited', 'tl_review', 'tl_done']);
    const withPay = timelineOf(b('PENDING_PAYMENT', { extraPhotosAmount: 2000 }));
    expect(withPay.map((s) => s.key)).toContain('tl_payment');
    expect(withPay.find((s) => s.key === 'tl_payment')?.state).toBe('current');
    const closed = timelineOf(b('COMPLETED', { closedByPhotographer: true }));
    expect(closed[closed.length - 1]).toMatchObject({ key: 'tl_closed', state: 'done' });
  });
  it('a sent-back book re-opens the editing step', () => {
    const t = timelineOf(b('SENT_TO_PHOTOGRAPHER', { changeRequestedAt: '2026-11-25' }));
    expect(t.find((s) => s.key === 'tl_edited')?.state).toBe('current');
  });
});

describe('copy', () => {
  it('has every key in English and falls back to it for a language that lacks one', () => {
    for (const k of PHOTOBOOK_COPY_KEYS) expect(pbCopy('en', k as CopyKey).length).toBeGreaterThan(0);
    expect(pbCopy('sw', 'st_review')).not.toBe(pbCopy('en', 'st_review'));
    expect(pbCopy('xx', 'st_review')).toBe(pbCopy('en', 'st_review'));
  });
  it('every drafted language covers the status, source and action wording', () => {
    const core = PHOTOBOOK_COPY_KEYS.filter((k) => /^(st_|src_|f_|act_|tl_|chip_)/.test(k));
    for (const lang of ['sw', 'rw', 'fr', 'es'] as const) {
      for (const k of core) expect(PHOTOBOOK_DRAFTED[lang]).toContain(k);
    }
  });
  it('fills placeholders and counts photos', () => {
    expect(pbCopy('en', 'act_pay', { price: 'RWF 2,000', n: 2 })).toBe('Pay RWF 2,000 for 2 extra photos');
    expect(photoCountLabel('en', 1)).toBe('1 photo');
    expect(photoCountLabel('en', 48)).toBe('48 photos');
    expect(photoCountLabel('en', undefined)).toBeUndefined();
  });
});
