import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { SharedWorkspaceHome } from './SharedWorkspaceHome';
import { WorkspaceChip } from './WorkspaceChip';
import { WorkspaceSwitcherSheet } from './WorkspaceSwitcherSheet';

/**
 * Inside someone else's workspace the Home draws no money and says whose workspace it is; the header chip appears
 * only there; and the switcher offers the own workspace and each invited one.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OWNER = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const mockState = {
  activeId: null as string | null,
  memberships: [] as { workspaceId: string; owner: { id: string; name: string } }[],
  switchTo: jest.fn(async () => {}),
};

jest.mock('@/store/workspace', () => ({
  useWorkspace: (sel: (s: unknown) => unknown) => sel(mockState),
  selectIsShared: (s: { activeId: string | null }) => s.activeId !== null,
  selectActive: (s: { activeId: string | null; memberships: { workspaceId: string }[] }) =>
    s.activeId ? s.memberships.find((m) => m.workspaceId === s.activeId) ?? null : null,
}));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/topbar/TopBar', () => ({ TopBar: () => null, useTopBarHeight: () => 0 }));
jest.mock('@/hooks/useScrollClearance', () => ({ useTabBarClearance: () => 0 }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: true, role: 'Photographer' }) }));
jest.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) => {
    const { Text: T, View } = jest.requireActual('react-native');
    const { createElement } = jest.requireActual('react');
    return createElement(View, null, createElement(T, null, title), createElement(T, null, subtitle), children);
  },
}));

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const make = async (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(el); });
  return r;
};

beforeEach(() => {
  mockState.activeId = null;
  mockState.memberships = [];
  mockState.switchTo.mockClear();
  mockPush.mockReset();
  mockReplace.mockReset();
});

describe('shared workspace home', () => {
  it('lists what a collaborator can do and what stays with the owner, and draws no money', async () => {
    mockState.activeId = OWNER;
    mockState.memberships = [{ workspaceId: OWNER, owner: { id: OWNER, name: 'Aline Uwase' } }];
    const r = await make(<SharedWorkspaceHome />);
    const t = text(r.root);
    expect(t).toContain("Aline Uwase's workspace");
    expect(t).toContain('Events and bookings');
    expect(t).toContain('Wallet, balance and earnings');
    expect(t).toContain('Payments, withdrawals and payout details');
    expect(t).not.toMatch(/[$]\s?\d|RWF|USD|Total Earnings/);
  });

  it('opens the work screens and offers the way back', async () => {
    mockState.activeId = OWNER;
    mockState.memberships = [{ workspaceId: OWNER, owner: { id: OWNER, name: 'Aline Uwase' } }];
    const r = await make(<SharedWorkspaceHome />);
    const press = (label: string) => r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityLabel === label)[0];
    await act(async () => { press('Events and bookings').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/events');
    await act(async () => { press('Clients').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/clients');
    const back = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).length > 0 && text(n) === 'Back to my workspace')[0];
    await act(async () => { back.props.onPress(); });
    expect(mockState.switchTo).toHaveBeenCalledWith(null);
    expect(mockPush.mock.calls.flat().some((p: unknown) => /wallet|transaction|payment/.test(String(p)))).toBe(false);
  });
});

describe('workspace chip', () => {
  it('renders nothing in the own workspace', async () => {
    const r = await make(<WorkspaceChip />);
    expect(r.toJSON()).toBeNull();
  });

  it('names the owner while working in a shared workspace, and says so before the details load', async () => {
    mockState.activeId = OWNER;
    let r = await make(<WorkspaceChip />);
    expect(text(r.root)).toContain('Shared workspace');
    mockState.memberships = [{ workspaceId: OWNER, owner: { id: OWNER, name: 'Aline Uwase' } }];
    r = await make(<WorkspaceChip />);
    expect(text(r.root)).toContain("Aline Uwase's workspace");
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === "Working in Aline Uwase's workspace").length).toBeGreaterThan(0);
  });
});

describe('workspace switcher', () => {
  it('offers the own workspace and each invited one, and switches', async () => {
    mockState.memberships = [{ workspaceId: OWNER, owner: { id: OWNER, name: 'Aline Uwase' } }];
    const onClose = jest.fn();
    const r = await make(<WorkspaceSwitcherSheet visible onClose={onClose} />);
    const t = text(r.root);
    expect(t).toContain('My workspace');
    expect(t).toContain("Aline Uwase's workspace");
    expect(t).toContain('Now in your own workspace');
    const row = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityLabel === "Aline Uwase's workspace")[0];
    await act(async () => { row.props.onPress(); });
    expect(onClose).toHaveBeenCalled();
    expect(mockState.switchTo).toHaveBeenCalledWith(OWNER);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('does nothing when the chosen workspace is already the current one', async () => {
    mockState.activeId = OWNER;
    mockState.memberships = [{ workspaceId: OWNER, owner: { id: OWNER, name: 'Aline Uwase' } }];
    const r = await make(<WorkspaceSwitcherSheet visible onClose={jest.fn()} />);
    expect(text(r.root)).toContain("Now in Aline Uwase's workspace");
    const row = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityLabel === "Aline Uwase's workspace")[0];
    await act(async () => { row.props.onPress(); });
    expect(mockState.switchTo).not.toHaveBeenCalled();
  });
});
