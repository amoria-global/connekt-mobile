import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useGetStarted } from './useGetStarted';
import { session } from './getStarted';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPrefs = jest.fn();
const mockPhotobooks = jest.fn();
const mockHosted = jest.fn();
const mockAlbums = jest.fn();
let mockCollab = false;
jest.mock('@/features/auth/role', () => ({
  useRole: () => ({ role: 'Photographer', isPhotographer: true, isCoordinator: false, isCollaboratorWorkspace: mockCollab }),
}));
jest.mock('@/features/preferences/api', () => ({ getPreferences: (...a: unknown[]) => mockPrefs(...a), preferencesBase: () => '/photographer/preferences' }));
jest.mock('@/features/photobooks/api', () => ({ listPhotobooks: () => mockPhotobooks() }));
jest.mock('@/features/hosting/api', () => ({ listHostedEvents: () => mockHosted() }));
jest.mock('@/features/gallery/api', () => ({ listAlbums: () => mockAlbums() }));
jest.mock('@/api/client', () => ({ api: { put: jest.fn().mockResolvedValue({}) } }));
jest.mock('@/services/storage', () => ({ storage: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/store/auth', () => ({ useAuth: (sel: (s: { user: { customerId: string } }) => unknown) => sel({ user: { customerId: 'u1' } }) }));

let latest: ReturnType<typeof useGetStarted>;
function Probe({ listLoaded = true, hasItems = false, reopenKey }: { listLoaded?: boolean; hasItems?: boolean; reopenKey?: string }) {
  latest = useGetStarted({ listLoaded, hasItems, reopenKey });
  return null;
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const mount = async (props: React.ComponentProps<typeof Probe> = {}) => {
  await act(async () => { TestRenderer.create(<Probe {...props} />); });
  await settle();
};

beforeEach(() => {
  session.shown = false;
  mockCollab = false;
  mockPrefs.mockResolvedValue({});
  mockPhotobooks.mockResolvedValue([]);
  mockHosted.mockResolvedValue([]);
  mockAlbums.mockResolvedValue([]);
});

describe('Get started opens only for an account that has created nothing', () => {
  it('opens when there are no events, hosted events, albums or photobooks', async () => {
    await mount();
    expect(latest.open).toBe(true);
  });

  it('stays closed when the account has albums, hosted events or photobooks', async () => {
    mockAlbums.mockResolvedValue([{ id: 'a' }]);
    await mount();
    expect(latest.open).toBe(false);
    session.shown = false;
    mockAlbums.mockResolvedValue([]);
    mockHosted.mockResolvedValue([{ id: 'h' }]);
    await mount();
    expect(latest.open).toBe(false);
    mockHosted.mockResolvedValue([]);
    mockPhotobooks.mockResolvedValue([{ id: 'p' }]);
    await mount();
    expect(latest.open).toBe(false);
  });

  it('stays closed when it cannot tell (a failed read), when events exist, or when dismissed on the account', async () => {
    mockAlbums.mockRejectedValue(new Error('offline'));
    await mount();
    expect(latest.open).toBe(false);
    mockAlbums.mockResolvedValue([]);
    await mount({ hasItems: true });
    expect(latest.open).toBe(false);
    mockPrefs.mockResolvedValue({ 'events.getStarted.dismissed': 'true' });
    await mount();
    expect(latest.open).toBe(false);
  });

  it('is never offered inside a workspace as a collaborator, and Help can still reopen it for others', async () => {
    mockCollab = true;
    await mount();
    expect(latest.actions).toEqual([]);
    expect(latest.open).toBe(false);
    mockCollab = false;
    mockPrefs.mockResolvedValue({ 'events.getStarted.dismissed': 'true' });
    await mount({ reopenKey: '123' });
    expect(latest.open).toBe(true);
  });
});
