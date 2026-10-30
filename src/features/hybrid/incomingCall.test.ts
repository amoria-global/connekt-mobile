import {
  canShowFullScreenCalls,
  cancelAllIncomingCalls,
  cancelIncomingCall,
  isIncomingCallAvailable,
  openFullScreenCallSettings,
  showIncomingCall,
} from './incomingCall';
import { INCOMING_CALL_CAPABILITY, reportedChannels } from '@/features/notifications/push';

describe('incoming call alert without the native module', () => {
  it('is unavailable and every call is a quiet no-op', () => {
    expect(isIncomingCallAvailable()).toBe(false);
    expect(showIncomingCall('c1', 'New offer', 'Wedding')).toBe(false);
    expect(canShowFullScreenCalls()).toBe(false);
    expect(() => {
      cancelIncomingCall('c1');
      cancelAllIncomingCalls();
      openFullScreenCallSettings();
    }).not.toThrow();
  });

  it('does not report the call capability, so the server keeps sending ordinary notifications', () => {
    expect(reportedChannels().split(',')).not.toContain(INCOMING_CALL_CAPABILITY);
    expect(reportedChannels().split(',')).toEqual(expect.arrayContaining(['default', 'urgent_alerts_v2']));
  });
});
