import { freshUnread, inAppAlertKind, showSystemBannerInForeground } from './inAppAlerts';

describe('in-app notification alerts', () => {
  it('rings for booking requests and chimes for booking and payment changes', () => {
    expect(inAppAlertKind({ id: '1', rawType: 'BOOKING', title: 'New Booking Request' })).toBe('ring');
    expect(inAppAlertKind({ id: '2', rawType: 'BOOKING', title: 'Booking Accepted' })).toBe('chime');
    expect(inAppAlertKind({ id: '3', rawType: 'PAYMENT', title: 'Deposit Received' })).toBe('chime');
  });

  it('rings for opportunities and ignores unrelated types', () => {
    expect(inAppAlertKind({ id: '1', rawType: 'OPPORTUNITY', title: 'New opportunity' })).toBe('ring');
    expect(inAppAlertKind({ id: '2', rawType: 'HYBRID_OPPORTUNITY', title: 'New opportunity' })).toBe('ring');
    expect(inAppAlertKind({ id: '3', rawType: 'EVENT', title: 'New Guest Joined' })).toBeNull();
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

  it('always allows the phone banner and sound so Android never silences or downgrades push notifications', () => {
    expect(showSystemBannerInForeground({ type: 'BOOKING' })).toBe(true);
    expect(showSystemBannerInForeground({ type: 'payment' })).toBe(true);
    expect(showSystemBannerInForeground({ type: 'OPPORTUNITY' })).toBe(true);
    expect(showSystemBannerInForeground({ type: 'HYBRID_OPPORTUNITY' })).toBe(true);
    expect(showSystemBannerInForeground({ type: 'CHAT' })).toBe(true);
    expect(showSystemBannerInForeground(undefined)).toBe(true);
  });
});
