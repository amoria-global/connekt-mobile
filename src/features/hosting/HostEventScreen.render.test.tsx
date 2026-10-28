import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import HostEventScreen from './HostEventScreen';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
const mockPublish = jest.fn();
const mockUpload = jest.fn();
jest.mock('@/features/events/api', () => ({
  ...jest.requireActual('@/features/events/api'),
  publishEvent: (...a: unknown[]) => mockPublish(...a),
  uploadEventPhoto: (...a: unknown[]) => mockUpload(...a),
}));
jest.mock('@/features/reference/api', () => ({
  listCurrencies: async () => [
    { id: 'c-rwf', code: 'RWF', name: 'Rwandan franc' },
    { id: 'c-usd', code: 'USD', name: 'US dollar' },
  ],
}));
jest.mock('@/services/imagePicker', () => ({ pickFromLibrary: async () => ({ uri: 'file:///cover.jpg', name: 'c.jpg', type: 'image/jpeg' }) }));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'Photographer' } }), {
    getState: () => ({ user: null }),
  }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const eligibility = (o: Record<string, unknown>) =>
  ok({ enabled: true, canHostFree: true, canHostPaid: true, reason: null, ...o });

function serve(elig: unknown) {
  mockGet.mockImplementation(async (url: string) => {
    if (url.includes('eligibility')) return elig;
    return ok({ hostPercent: '70', platformPercent: '30', hostEarnsPerTicket: 3500 });
  });
}

const text = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const settle = async () => {
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
};
async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<HostEventScreen />);
  });
  await settle();
  return r;
}
const byLabel = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function')[0];
const titled = (r: TestRenderer.ReactTestRenderer, title: string) =>
  r.root.findAll((n) => n.props?.title === title && typeof n.props?.onPress === 'function')[0];
const field = (r: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance =>
  r.root.findAll((n) => n.props?.label === label && typeof n.props?.onChangeText === 'function')[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue(ok({ id: 'ev1', title: 'Rooftop set' }));
  mockUpload.mockResolvedValue(undefined);
  mockPublish.mockResolvedValue(undefined);
});

describe('HostEventScreen', () => {
  it('says so, and offers no form, when the server has hosting switched off', async () => {
    serve(eligibility({ enabled: false, canHostFree: false, canHostPaid: false, reason: 'HOSTING_DISABLED' }));
    const r = await mount();
    expect(text(r)).toContain('Hosting is not available');
    expect(titled(r, 'Publish and go live')).toBeUndefined();
  });

  it('tells a non-photographer account that hosting is for photographers', async () => {
    serve(eligibility({ canHostFree: false, canHostPaid: false, reason: 'NOT_A_PHOTOGRAPHER' }));
    const r = await mount();
    expect(text(r)).toContain('photographer accounts');
  });

  it('shows an error with a retry when eligibility cannot be read', async () => {
    mockGet.mockRejectedValue({ status: 500, message: 'Server error' });
    const r = await mount();
    expect(text(r)).toContain('Server error');
    expect(text(r)).toContain('Try again');
  });

  it('without verification, paid is locked behind a path to verification', async () => {
    serve(eligibility({ canHostPaid: false, reason: 'KYC_REQUIRED_FOR_PAID' }));
    const r = await mount();
    expect(text(r)).toContain('identity verification');
    expect(text(r)).toContain('Verify my identity');
    expect(r.root.findAll((n) => n.props?.label === 'Price')).toHaveLength(0);
  });

  it('asks for a cover and a title before anything is sent', async () => {
    serve(eligibility({}));
    const r = await mount();
    await act(async () => {
      await titled(r, 'Publish and go live').props.onPress();
    });
    expect(text(r)).toContain('Add a cover photo.');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('blocks both publish buttons until Wish invites is chosen, shows the error, then sends the choice', async () => {
    serve(eligibility({}));
    const r = await mount();
    expect(text(r)).toContain('Wish invites');
    expect(text(r)).toContain('Allow viewers to invite friends and family to send message and video wishes?');
    expect(r.root.findAll((n) => n.props?.accessibilityRole === 'radio' && n.props?.accessibilityState?.checked === true)).toHaveLength(0);
    await act(async () => {
      await byLabel(r, 'Add a cover photo').props.onPress();
    });
    await act(async () => {
      field(r, 'Title').props.onChangeText('Rooftop set');
    });
    await act(async () => {
      await titled(r, 'Publish and go live').props.onPress();
    });
    await act(async () => {
      await titled(r, 'Publish and schedule for later').props.onPress();
    });
    expect(text(r)).toContain('Choose whether viewers can invite others');
    expect(mockPost).not.toHaveBeenCalled();

    await act(async () => {
      byLabel(r, 'Disable').props.onPress();
    });
    expect(text(r)).not.toContain('Choose whether viewers can invite others');
    expect([...new Set(r.root.findAll((n) => n.props?.accessibilityRole === 'radio' && n.props?.accessibilityState?.checked === true).map((n) => n.props.accessibilityLabel))]).toEqual(['Disable']);
    await act(async () => {
      await titled(r, 'Publish and schedule for later').props.onPress();
    });
    await settle();
    expect(mockPost.mock.calls[0][1]).toMatchObject({ allowWishInvites: false });
  });

  it('creates, uploads, publishes, then opens the stream controls, and a double tap makes one event', async () => {
    serve(eligibility({}));
    const r = await mount();
    await act(async () => {
      await byLabel(r, 'Add a cover photo').props.onPress();
    });
    await act(async () => {
      field(r, 'Title').props.onChangeText('Rooftop set');
    });
    await act(async () => {
      byLabel(r, 'Enable').props.onPress();
    });
    await act(async () => {
      const press = titled(r, 'Publish and go live').props.onPress;
      void press();
      void press();
    });
    await settle();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/photographer/hosted-events');
    expect(mockPost.mock.calls[0][1]).toMatchObject({ allowWishInvites: true });
    expect(mockUpload).toHaveBeenCalledWith('ev1', expect.objectContaining({ uri: 'file:///cover.jpg' }), false);
    expect(mockPublish).toHaveBeenCalledWith('ev1', false);
    expect(mockReplace).toHaveBeenCalledWith('/stream/control/ev1');
  });

  it('a failed publish says so, keeps the event, and does not navigate; the retry does not create another', async () => {
    serve(eligibility({}));
    mockPublish.mockRejectedValueOnce({ message: 'Not ready' });
    const r = await mount();
    await act(async () => {
      await byLabel(r, 'Add a cover photo').props.onPress();
    });
    await act(async () => {
      field(r, 'Title').props.onChangeText('Rooftop set');
    });
    await act(async () => {
      byLabel(r, 'Enable').props.onPress();
    });
    await act(async () => {
      await titled(r, 'Publish and go live').props.onPress();
    });
    expect(text(r)).toContain('Not ready');
    expect(text(r)).toContain('Your event is saved');
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      await titled(r, 'Try again').props.onPress();
    });
    await settle();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/stream/control/ev1');
  });

  it('shows the server-computed earnings for a paid event', async () => {
    serve(eligibility({}));
    const r = await mount();
    const paid = r.root.findAll((n) => n.props?.options && n.props?.onChange)[0];
    await act(async () => {
      paid.props.onChange('paid');
    });
    await act(async () => {
      field(r, 'Price').props.onChangeText('5000');
    });
    await act(async () => {
      await new Promise((res) => setTimeout(res, 600));
    });
    expect(text(r)).toContain('You keep 70% of each ticket');
  });
});
