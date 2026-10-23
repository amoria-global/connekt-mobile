import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

/**
 * The Collaborate screen opens on Workspace access, and a chooser says how album collaboration differs. The route says
 * where it opens, so a link back from a joined album lands on the albums side. Rendered over fake album data
 * (react-test-renderer); it never talks to a backend.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockParams: { tab?: string } = {};
jest.mock('expo-router', () => {
  const R = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void) => { R.useEffect(() => { cb(); }, []); },
  };
});
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/collab/api', () => ({
  listOwnedAlbums: jest.fn(async () => [{ id: 'a1', title: 'Wedding at the lake', coverImage: null, imageCount: 12, collaboratorCount: 1, pendingCount: 2 }]),
  listJoinedAlbums: jest.fn(async () => []),
}));
jest.mock('@/features/workspace/WorkspaceAccessPanel', () => {
  const { Text: T } = require('react-native');
  return { WorkspaceAccessPanel: () => <T>workspace panel</T> };
});
jest.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ language: 'en' }) }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: true, role: 'Photographer' }) }));
jest.mock('@/store/auth', () => ({ isApiError: () => false, useAuth: Object.assign(() => ({}), { getState: () => ({ user: {} }) }) }));

import CollaborateHub from '@/app/(app)/collaborate/index';

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const radios = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => n.props?.accessibilityRole === 'radio' && typeof n.props.onPress === 'function');
const checked = (r: TestRenderer.ReactTestRenderer) => radios(r).filter((n) => n.props.accessibilityState?.checked).map((n) => n.props.accessibilityLabel as string);
const tabs = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => n.props?.accessibilityRole === 'button' && n.props.accessibilityState && 'selected' in n.props.accessibilityState && typeof n.props.onPress === 'function');

async function mount(tab?: string) {
  mockParams.tab = tab;
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<CollaborateHub />); });
  await act(async () => {});
  return r;
}

describe('Collaborate screen', () => {
  it('opens on Workspace access with both choices explained', async () => {
    const r = await mount();
    expect(radios(r)).toHaveLength(2);
    expect(checked(r)).toHaveLength(1);
    expect(checked(r)[0]).toContain('Workspace access');
    const all = text(r.root);
    expect(all).toContain('workspace panel');
    // The heading matches the side, not the old "Work on albums together".
    expect(all).toContain('Work together');
    expect(all).not.toContain('Work on albums together');
    expect(all).toContain('WHOLE WORKSPACE');
    expect(all).toContain('ONE ALBUM');
    // The chosen card lists its points; the other stays short.
    expect(all).toContain('Withdrawals and transactions stay with you');
    expect(all).not.toContain('They never see your bookings, clients or money');
    // The album tabs, the join row and the album stats belong to the albums side.
    expect(all).not.toContain('My albums');
    expect(all).not.toContain('Wedding at the lake');
  });

  it('still opens on the workspace for the old workspace route', async () => {
    const r = await mount('workspace');
    expect(checked(r)[0]).toContain('Workspace access');
  });

  it.each(['mine', 'joined'])('opens on the albums side for ?tab=%s, so a link back from an album lands there', async (tab) => {
    const r = await mount(tab);
    expect(checked(r)[0]).toContain('Album collaboration');
    const all = text(r.root);
    expect(all).not.toContain('workspace panel');
    expect(all).toContain('They never see your bookings, clients or money');
    expect(all).not.toContain('Withdrawals and transactions stay with you');
    expect(all).toContain('My albums');
    expect(all).toContain('Joined');
    const tabLabels = tabs(r).map((n) => text(n)).join(' ');
    expect(tabLabels).toContain('My albums');
    expect(tabLabels).toContain('Joined');
    expect(tabLabels).not.toContain('Workspace access');
    expect(all).toContain('Work on albums together');
    expect(all).not.toContain('Choose how you want to work with another photographer.');
  });

  it('switching the choice swaps the content', async () => {
    const r = await mount();
    await act(async () => { radios(r)[1].props.onPress(); });
    expect(checked(r)[0]).toContain('Album collaboration');
    expect(text(r.root)).toContain('Wedding at the lake');
    expect(text(r.root)).not.toContain('workspace panel');
    await act(async () => { radios(r)[0].props.onPress(); });
    expect(checked(r)[0]).toContain('Workspace access');
    expect(text(r.root)).toContain('workspace panel');
  });

  it('offers a way across from each side', async () => {
    const r = await mount();
    const toAlbums = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityRole === 'button' && text(n) === 'Use Album collaboration')[0];
    expect(toAlbums).toBeDefined();
    await act(async () => { toAlbums.props.onPress(); });
    expect(checked(r)[0]).toContain('Album collaboration');
    const toWorkspace = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityRole === 'button' && text(n) === 'Use Workspace access')[0];
    expect(toWorkspace).toBeDefined();
    expect(tabs(r).length).toBeGreaterThan(0);
  });
});
