import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import PackagesScreen from '@/app/(app)/packages';
import { getErrorState, resetErrorState } from '@/features/errors/store';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): photographer My packages with the real packages
 * API module over a faked transport. The price is the package's own stored currency with its ISO code, a single video
 * reads "1 video", Delete lives only in the menu and names the package, and a failed delete keeps the package listed.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a), put: jest.fn(), post: jest.fn() } };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Aline', customerType: 'Photographer' }, status: 'authenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const raw = (over: Record<string, unknown>) => ({
  isActive: true,
  currencyAbbreviation: 'RWF',
  priceUnit: 'per session',
  ...over,
});
const SERVER = [
  raw({ id: 'i-1', packageName: 'Diamond', price: 100000, serviceType: 'STUDIO', durationHours: 2, includedPhotos: 50, includedVideos: 1, deliveryDays: 3, description: 'Studio session with a highlight video.' }),
  raw({ id: 'i-2', packageName: 'Gold', price: 60000, serviceType: 'STUDIO', includedPhotos: 5 }),
  raw({ id: 'o-1', packageName: 'Wedding', price: 970000, serviceType: 'OUTDOOR', priceUnit: 'per event', features: [{ featureName: 'Printed album', isIncluded: true }] }),
];

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const texts = (root: ReactTestInstance): string[] => root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
const has = (root: ReactTestInstance, s: string) => texts(root).some((t) => t.includes(s));
const press = async (root: ReactTestInstance, label: string) => {
  const node = root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`no pressable "${label}"`);
  await act(async () => { node.props.onPress(); });
  await flush();
};

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<PackagesScreen />); });
  await flush();
  return r;
}

beforeEach(() => {
  mockGet.mockReset();
  mockDelete.mockReset();
  mockPush.mockReset();
  resetErrorState();
});

describe('My packages screen', () => {
  it('lists packages with the stored currency code, counts in the filter, plurals and no old action cards', async () => {
    mockGet.mockResolvedValue({ action: 1, data: SERVER });
    const root = (await mount()).root;
    expect(has(root, 'RWF 100,000')).toBe(true);
    expect(has(root, 'RWF 970,000')).toBe(true);
    expect(texts(root).some((t) => /^RF\b/.test(t))).toBe(false);
    expect(has(root, '1 video')).toBe(true);
    expect(has(root, '1 videos')).toBe(false);
    expect(has(root, 'All 3')).toBe(true);
    expect(has(root, 'Indoor 2')).toBe(true);
    expect(has(root, 'Outdoor 1')).toBe(true);
    expect(has(root, 'Update Package')).toBe(false);
    expect(has(root, 'Manual Upload')).toBe(false);
    expect(has(root, 'Top tier')).toBe(true);
    expect(has(root, 'Printed album')).toBe(true);
  });

  it('the filter narrows the list', async () => {
    mockGet.mockResolvedValue({ action: 1, data: SERVER });
    const root = (await mount()).root;
    const tab = root.findAll((n) => n.props.accessibilityRole === 'tab' || (typeof n.props.onPress === 'function' && texts(n).includes('Outdoor 1')))[0];
    await act(async () => { tab.props.onPress(); });
    expect(has(root, 'Wedding')).toBe(true);
    expect(has(root, 'Diamond')).toBe(false);
  });

  it('Delete is only in the menu, names the package, and a failed delete keeps the package and opens the error sheet', async () => {
    mockGet.mockResolvedValue({ action: 1, data: SERVER });
    mockDelete.mockRejectedValue({ status: 409, message: 'This package is attached to an active event.' });
    const root = (await mount()).root;
    expect(root.findAll((n) => n.props.accessibilityLabel === 'Delete Diamond')).toHaveLength(0);

    await press(root, 'More actions for Diamond');
    await press(root, 'Delete');
    expect(has(root, 'Delete "Diamond"?')).toBe(true);
    await press(root, 'Delete package');

    expect(mockDelete).toHaveBeenCalledWith('/photographer/packages/i-1');
    expect(has(root, 'Diamond')).toBe(true);
    expect(getErrorState().sheet).not.toBeNull();
    expect(getErrorState().sheet?.presentation.actions.map((a) => a.id)).toContain('retry');
  });

  it('a successful delete reloads the list', async () => {
    mockGet.mockResolvedValueOnce({ action: 1, data: SERVER }).mockResolvedValueOnce({ action: 1, data: SERVER.slice(1) });
    mockDelete.mockResolvedValue({ action: 1 });
    const root = (await mount()).root;
    await press(root, 'More actions for Diamond');
    await press(root, 'Delete');
    await press(root, 'Delete package');
    expect(has(root, 'Gold')).toBe(true);
    expect(has(root, 'Diamond')).toBe(false);
  });

  it('the Add sheet offers manual, brochure and replace-all, and replace confirms with the count first', async () => {
    mockGet.mockResolvedValue({ action: 1, data: SERVER });
    const root = (await mount()).root;
    await press(root, 'New package');
    expect(has(root, 'Create manually')).toBe(true);
    expect(has(root, 'Replace all from brochure')).toBe(true);
    await press(root, 'Replace all from brochure');
    expect(has(root, 'This replaces your 3 packages')).toBe(true);
    expect(has(root, 'Bookings already made are kept')).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
    await press(root, 'Choose a brochure');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/package/new', params: { mode: 'ai', replace: '1' } });
  });

  it('shows the empty state with a next step, and an error state with Try again that is never "No packages yet"', async () => {
    mockGet.mockResolvedValue({ action: 1, data: [] });
    let root = (await mount()).root;
    expect(has(root, 'No packages yet')).toBe(true);
    expect(has(root, 'Add a package')).toBe(true);

    mockGet.mockReset();
    mockGet.mockRejectedValue({ status: 0, message: 'Network request failed' });
    root = (await mount()).root;
    expect(has(root, 'Could not load your packages')).toBe(true);
    expect(has(root, 'No packages yet')).toBe(false);
    expect(has(root, 'Try again')).toBe(true);
  });
});
