import { archivedMessage, archivedOn, ownerArchivedMessage, restoreConfirmMessage } from './archivedCopy';

describe('archived album copy', () => {
  it('names the archive date in Kigali time', () => {
    expect(archivedOn('2026-10-30T23:30:00Z')).toBe('31 October 2026');
    expect(archivedOn('2026-10-30T10:00:00')).toBe('30 October 2026');
  });

  it('has no date for a missing or unreadable one', () => {
    expect(archivedOn(undefined)).toBeNull();
    expect(archivedOn('not a date')).toBeNull();
  });

  it('tells the owner when it was archived, what restoring costs and what they get back', () => {
    expect(archivedMessage({ lockedAt: '2026-10-30T10:00:00', price: 'RWF 5,000', canRestoreInApp: true }))
      .toBe('This album was archived on 30 October 2026. Restore it for RWF 5,000 to view and download again.');
  });

  it('still reads well without a date or a price', () => {
    expect(archivedMessage({ price: null, canRestoreInApp: true })).toBe('This album was archived. Restore it to view and download again.');
  });

  it('points to support where the app cannot take the payment, never saying cold storage', () => {
    const m = archivedMessage({ lockedAt: '2026-10-30T10:00:00', price: 'RWF 5,000', canRestoreInApp: false });
    expect(m).toContain('Contact support');
    expect(m).not.toMatch(/cold storage/i);
  });

  it('asks for confirmation with the price and the length of access', () => {
    expect(restoreConfirmMessage('Wedding', 'RWF 5,000')).toBe('You will pay RWF 5,000 to restore "Wedding". You will have access to it again for 1 year.');
    expect(restoreConfirmMessage('Wedding')).toContain('the archive fee');
  });
});

describe('owner of an archived album', () => {
  it('says what they keep, what clients lose and where to restore it', () => {
    expect(ownerArchivedMessage('2026-10-30T10:00:00')).toBe(
      'This album was archived on 30 October 2026. You can still see your photos, but clients and buyers cannot. Restore it on the Connekyt website to open it again.');
    expect(ownerArchivedMessage()).toContain('This album was archived. You can still see');
  });
});
