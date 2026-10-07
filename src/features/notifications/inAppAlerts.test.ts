import { freshUnread, inAppAlertKind, showSystemBannerInForeground } from './inAppAlerts';

describe('in-app notification alerts', () => {
  it('rings for a booking request and chimes for other booking and payment changes', () => {
    expect(inAppAlertKind({ id: '1', rawType: 'BOOKING', title: 'New Booking Request' })).toBe('ring');
    expect(inAppAlertKind({ id: '2', rawType: 'BOOKING', title: 'Booking Accepted' })).toBe('chime');
    expect(inAppAlertKind({ id: '3', rawType: 'PAYMENT', title: 'Deposit Received' })).toBe('chime');
  });

  it('leaves opportunities to the opportunity alert, and ignores other types', () => {
    expect(inAppAlertKind({ id: '1', rawType: 'OPPORTUNITY', title: 'New opportunity' })).toBeNull();
    expect(inAppAlertKind({ id: '2', rawType: 'EVENT', title: 'New Guest Joined' })).toBeNull();
  });

  it('stays quiet on the first poll and alerts only for unseen unread notifications', () => {
    expect(freshUnread(null, [{ id: 'a', read: false }])).toEqual([]);
    const fresh = freshUnread(new Set(['a']), [
      { id: 'a', read: false },
      { id: 'b', read: false },
      { id: 'c', read: true },
    ]);
    expect(fresh.map((n) => n.id)).toEqual(['b']);
  });

  it('suppresses the phone banner only for the types the in-app alert replaces', () => {
    expect(showSystemBannerInForeground({ type: 'BOOKING' })).toBe(false);
    expect(showSystemBannerInForeground({ type: 'payment' })).toBe(false);
    expect(showSystemBannerInForeground({ type: 'OPPORTUNITY' })).toBe(true);
    expect(showSystemBannerInForeground(undefined)).toBe(true);
  });
});
