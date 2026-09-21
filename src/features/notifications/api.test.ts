import {
  mapBackendType,
  notificationBase,
} from './api';

describe('Notifications API mapping & endpoints', () => {
  it('correctly maps backend notification types by role', () => {
    expect(mapBackendType('MEDIA', 'client')).toBe('album');
    expect(mapBackendType('ALBUM', 'photographer')).toBe('album');
    expect(mapBackendType('PAYMENT', 'client')).toBe('gift');
    expect(mapBackendType('PAYMENT', 'event-coordinator')).toBe('streamfee');
    expect(mapBackendType('PAYMENT', 'photographer')).toBe('payment');
    expect(mapBackendType('TIP', 'photographer')).toBe('tip');
    expect(mapBackendType('BONUS', 'photographer')).toBe('bonus');
    expect(mapBackendType('BOOKING', 'client')).toBe('booking');
    expect(mapBackendType('EVENT', 'client')).toBe('booking');
    expect(mapBackendType('SECURITY', 'client')).toBe('security');
    expect(mapBackendType('SYSTEM', 'client')).toBe('security');
    expect(mapBackendType('PHOTOBOOK', 'client')).toBe('photobook');
    expect(mapBackendType('REVIEW', 'photographer')).toBe('review');
  });

  it('correctly resolves endpoint base paths by role', () => {
    expect(notificationBase('Client')).toBe('/customer/notifications');
    expect(notificationBase('client')).toBe('/customer/notifications');
    expect(notificationBase('User')).toBe('/customer/notifications');
    expect(notificationBase('Photographer')).toBe('/photographer/notifications');
    expect(notificationBase('photographer')).toBe('/photographer/notifications');
    expect(notificationBase('Coordinator')).toBe('/coordinator/notifications');
    expect(notificationBase('event-coordinator')).toBe('/coordinator/notifications');
    expect(notificationBase(true)).toBe('/photographer/notifications');
    expect(notificationBase(false)).toBe('/customer/notifications');
    expect(notificationBase(undefined)).toBe('/customer/notifications');
  });
});
