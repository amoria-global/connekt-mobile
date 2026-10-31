const mockSetNotificationCategoryAsync = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockSetNotificationChannelAsync = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockGetPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockRequestPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockGetExpoPushTokenAsync = jest.fn((..._args: unknown[]) =>
  Promise.resolve({ data: 'ExponentPushToken[test-token-1]' }),
);
const mockGetLastNotificationResponseAsync = jest.fn();
const mockClearLastNotificationResponseAsync = jest.fn(() => Promise.resolve());
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockAddPushTokenListener = jest.fn();
const mockRegisterPushToken = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockUnregisterPushToken = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@/theme', () => ({ lightPalette: { primary: '#D4AF37', accent: '#FF9800' } }));
jest.mock('@/features/hybrid/incomingCall', () => ({
  isIncomingCallAvailable: () => false,
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: (...args: unknown[]) => mockSetNotificationCategoryAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  getLastNotificationResponseAsync: () => mockGetLastNotificationResponseAsync(),
  clearLastNotificationResponseAsync: () => mockClearLastNotificationResponseAsync(),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  addPushTokenListener: (...args: unknown[]) => mockAddPushTokenListener(...args),
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidNotificationPriority: { MAX: 'max' },
}));

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
}));
jest.mock('@/features/notifications/api', () => ({
  registerPushToken: (...args: unknown[]) => mockRegisterPushToken(...args),
  unregisterPushToken: (...args: unknown[]) => mockUnregisterPushToken(...args),
}));

import {
  addNotificationResponseListener,
  consumeInitialNotificationResponse,
  registerForPushNotifications,
  resetHandledNotificationResponses,
  startPushTokenRefreshListener,
  unregisterFromPushNotifications,
} from './push';

describe('Push notification registration, token lifecycle, and tap deduplication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHandledNotificationResponses();
  });

  it('registers Expo push token, sets up OPPORTUNITY_ALERT category with Accept/Reject, and unregisters on logout', async () => {
    const token = await registerForPushNotifications();
    expect(token).toBe('ExponentPushToken[test-token-1]');
    expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
      'OPPORTUNITY_ALERT',
      expect.arrayContaining([
        expect.objectContaining({ identifier: 'ACTION_APPROVE', buttonTitle: 'Accept' }),
        expect.objectContaining({ identifier: 'ACTION_DECLINE', buttonTitle: 'Reject' }),
      ]),
    );
    expect(mockRegisterPushToken).toHaveBeenCalledWith(
      'ExponentPushToken[test-token-1]',
      expect.any(String),
      expect.stringContaining('urgent_alerts_v2'),
    );

    await unregisterFromPushNotifications();
    expect(mockUnregisterPushToken).toHaveBeenCalledWith('ExponentPushToken[test-token-1]');
  });

  it('re-registers with the backend when the OS rotates the push token', async () => {
    let tokenCallback: (() => Promise<void> | void) | undefined;
    mockAddPushTokenListener.mockImplementation((cb: () => Promise<void> | void) => {
      tokenCallback = cb;
      return { remove: jest.fn() };
    });
    mockGetExpoPushTokenAsync.mockResolvedValueOnce({ data: 'ExponentPushToken[test-token-2]' });

    const stop = startPushTokenRefreshListener();
    expect(tokenCallback).toBeDefined();
    await tokenCallback?.();
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalled();
    expect(mockRegisterPushToken).toHaveBeenCalledWith(
      'ExponentPushToken[test-token-2]',
      'android',
      expect.stringContaining('urgent_alerts_v2'),
    );
    stop();
  });

  it('consumes cold-start notification response once and prevents duplicate listener execution', async () => {
    const fakeResponse = {
      actionIdentifier: 'ACTION_APPROVE',
      notification: {
        request: {
          identifier: 'notif-123',
          content: {
            data: { type: 'OPPORTUNITY', candidateId: 'cand-999', link: '/opportunities/cand-999' },
          },
        },
      },
    };
    mockGetLastNotificationResponseAsync.mockResolvedValue(fakeResponse);

    let listenerCb: ((resp: typeof fakeResponse) => void) | undefined;
    mockAddNotificationResponseReceivedListener.mockImplementation((cb: typeof listenerCb) => {
      listenerCb = cb;
      return { remove: jest.fn() };
    });

    const onOpen = jest.fn();
    const unsub = addNotificationResponseListener(onOpen);
    await consumeInitialNotificationResponse(onOpen);

    // Cold-start tap handled once
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(
      { type: 'OPPORTUNITY', candidateId: 'cand-999', link: '/opportunities/cand-999' },
      'ACTION_APPROVE',
    );
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalled();

    // If the runtime listener also fires with the same notification + action, it is ignored
    listenerCb?.(fakeResponse);
    expect(onOpen).toHaveBeenCalledTimes(1);

    unsub();
  });
});
