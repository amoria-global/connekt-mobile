import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The collaborator's screens over fakes: first-time setup from the emailed link, sign-in with an emailed code, and the
 * workspace picker. The fakes stand in for the server; the screens show what it says and never decide whether a link
 * or a code is good.
 */
const mockParams: Record<string, string> = {};
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/features/auth/AuthGlassLayout', () => ({
  AuthGlassLayout: ({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) => {
    const { Text: T, View } = jest.requireActual('react-native');
    return <View><T>{title}</T><T>{subtitle}</T>{children}</View>;
  },
}));
jest.mock('@/i18n/sharedStrings', () => ({ useSharedT: () => ({ tr: (s: string) => s }) }));
jest.mock('@/components/ui/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual('react-native');
    return <View>{children}</View>;
  },
}));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
const mockApply = jest.fn();
const mockLogout = jest.fn();
jest.mock('@/store/auth', () => ({
  useAuth: (sel: (s: unknown) => unknown) => sel({ applySession: mockApply, logout: mockLogout }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));
const mockPreview = jest.fn();
const mockSetup = jest.fn();
const mockSendCode = jest.fn();
const mockVerifyCode = jest.fn();
jest.mock('@/features/auth/api', () => ({
  previewWorkspaceSetup: (...a: unknown[]) => mockPreview(...a),
  completeWorkspaceSetup: (...a: unknown[]) => mockSetup(...a),
  sendLoginCode: (...a: unknown[]) => mockSendCode(...a),
  verifyLoginCode: (...a: unknown[]) => mockVerifyCode(...a),
  isNeedsTotp: () => false,
}));
const wsState: Record<string, unknown> = {};
const mockSwitchTo = jest.fn(async () => {});
const mockRefresh = jest.fn(async () => {});
jest.mock('@/store/workspace', () => ({
  useWorkspace: (sel: (s: unknown) => unknown) => sel({ ...wsState, switchTo: mockSwitchTo, refresh: mockRefresh }),
}));
const mockRole = { isCollaboratorLogin: true };
jest.mock('@/features/auth/role', () => ({ useRole: () => mockRole }));

import WorkspaceSetupScreen from '@/app/(public)/workspace-setup';
import LoginCodeScreen from '@/app/(auth)/login-code';
import { WorkspacePicker } from './WorkspacePicker';

const text = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const inputs = (r: TestRenderer.ReactTestRenderer): ReactTestInstance[] => r.root.findAllByType(TextInput);
const press = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.accessibilityLabel === label || n.props.title === label))[0];
async function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(el); });
  await act(async () => {});
  return r;
}
const typeAt = async (r: TestRenderer.ReactTestRenderer, i: number, v: string) => { await act(async () => { inputs(r)[i].props.onChangeText(v); }); };

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockParams).forEach((k) => delete mockParams[k]);
  Object.keys(wsState).forEach((k) => delete wsState[k]);
  Object.assign(wsState, { memberships: [], loading: false, hydrated: true, activeId: null });
  mockRole.isCollaboratorLogin = true;
});

describe('workspace setup screen', () => {
  beforeEach(() => { Object.assign(mockParams, { invite: '11111111-1111-1111-1111-111111111111', t: 'secret' }); });

  it('says the link is no longer valid when it has none, and asks the server nothing', async () => {
    Object.keys(mockParams).forEach((k) => delete mockParams[k]);
    const r = await mount(<WorkspaceSetupScreen />);
    expect(text(r)).toContain('This link is no longer valid');
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it('shows who invited them and the fixed email, with only a password and its confirmation', async () => {
    mockPreview.mockResolvedValue({ found: true, open: true, ownerName: 'Eric N.', email: 'new@example.com', account: 'none' });
    const r = await mount(<WorkspaceSetupScreen />);
    expect(text(r)).toContain('Eric N. invited you to their workspace');
    expect(inputs(r)).toHaveLength(3);
    expect(inputs(r)[0].props.value).toBe('new@example.com');
    expect(inputs(r)[0].props.editable).toBe(false);
    expect(mockPreview).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'secret');
  });

  it('keeps Open workspace off until the password is acceptable and both match, then signs in and goes into the app', async () => {
    mockPreview.mockResolvedValue({ found: true, open: true, ownerName: 'Eric N.', email: 'new@example.com', account: 'none' });
    mockSetup.mockResolvedValue({ token: 't' });
    const r = await mount(<WorkspaceSetupScreen />);
    const button = () => r.root.findAll((n) => n.props?.title === 'Open workspace')[0];
    expect(button().props.disabled).toBe(true);
    await typeAt(r, 1, 'Sup3r$ecret!');
    await typeAt(r, 2, 'Different1!');
    expect(text(r)).toContain('The two passwords do not match');
    expect(button().props.disabled).toBe(true);
    await typeAt(r, 2, 'Sup3r$ecret!');
    expect(button().props.disabled).toBeFalsy();
    await act(async () => { await button().props.onPress(); });
    expect(mockSetup).toHaveBeenCalledWith({ invitationId: '11111111-1111-1111-1111-111111111111', token: 'secret', password: 'Sup3r$ecret!', confirmPassword: 'Sup3r$ecret!' });
    expect(mockApply).toHaveBeenCalledWith({ token: 't' });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows the server answer to a weak password and stays on the form', async () => {
    mockPreview.mockResolvedValue({ found: true, open: true, ownerName: 'Eric N.', email: 'new@example.com', account: 'none' });
    mockSetup.mockRejectedValue({ status: 400, message: 'This password has appeared in a known data breach.', errorCode: 'WEAK_PASSWORD' });
    const r = await mount(<WorkspaceSetupScreen />);
    await typeAt(r, 1, 'Sup3r$ecret!');
    await typeAt(r, 2, 'Sup3r$ecret!');
    await act(async () => { await r.root.findAll((n) => n.props?.title === 'Open workspace')[0].props.onPress(); });
    expect(text(r)).toContain('known data breach');
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('an address with a login is asked to sign in, never to set a second password', async () => {
    mockPreview.mockResolvedValue({ found: true, open: true, ownerName: 'Eric N.', email: 'client@example.com', account: 'existing' });
    const r = await mount(<WorkspaceSetupScreen />);
    expect(text(r)).toContain('already has a Connekyt account');
    expect(inputs(r)).toHaveLength(0);
    await act(async () => { r.root.findAll((n) => n.props?.title === 'Sign in to add this workspace')[0].props.onPress(); });
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/login', params: { email: 'client@example.com' } });
  });
});

describe('login with an emailed code', () => {
  it('sends the code, then signs in with it, showing the server answer for a wrong one', async () => {
    mockSendCode.mockResolvedValue(undefined);
    const r = await mount(<LoginCodeScreen />);
    await typeAt(r, 0, 'collab@example.com');
    await act(async () => { await r.root.findAll((n) => n.props?.title === 'Send code')[0].props.onPress(); });
    expect(mockSendCode).toHaveBeenCalledWith('collab@example.com');
    expect(text(r)).toContain('If collab@example.com can sign in with a code');

    mockVerifyCode.mockRejectedValueOnce({ status: 400, message: 'That code is not right.', attemptsLeft: 2, errorCode: 'WRONG_CODE' });
    await act(async () => { await r.root.findAll((n) => typeof n.props?.onComplete === 'function')[0].props.onComplete('123456'); });
    expect(mockVerifyCode).toHaveBeenCalledWith('collab@example.com', '123456');
    expect(mockApply).not.toHaveBeenCalled();

    mockVerifyCode.mockResolvedValueOnce({ token: 't' });
    await act(async () => { await r.root.findAll((n) => typeof n.props?.onComplete === 'function')[0].props.onComplete('654321'); });
    expect(mockApply).toHaveBeenCalledWith({ token: 't' });
  });
});

describe('workspace picker', () => {
  const two = [
    { workspaceId: 'w1', owner: { id: 'w1', name: 'Aline Uwase' }, role: 'COLLABORATOR' },
    { workspaceId: 'w2', owner: { id: 'w2', name: 'Eric Mugisha' }, role: 'COLLABORATOR' },
  ];

  it('lists each workspace of a collaborator, with no business of their own, and opens the one chosen', async () => {
    wsState.memberships = two;
    const r = await mount(<WorkspacePicker />);
    const t = text(r);
    expect(t).toContain("Aline Uwase's workspace");
    expect(t).toContain("Eric Mugisha's workspace");
    expect(t).not.toContain('My business');
    await act(async () => { press(r, "Eric Mugisha's workspace. Workspace collaborator").props.onPress(); });
    expect(mockSwitchTo).toHaveBeenCalledWith('w2');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('offers My business next to the workspaces for a login that has one', async () => {
    mockRole.isCollaboratorLogin = false;
    wsState.memberships = two;
    wsState.activeId = 'w1'; // working in a workspace, so going back to the business is a switch
    const r = await mount(<WorkspacePicker />);
    expect(text(r)).toContain('My business');
    await act(async () => { press(r, 'My business. Your own account').props.onPress(); });
    expect(mockSwitchTo).toHaveBeenCalledWith(null);
  });

  it('opens the only workspace of a collaborator by itself', async () => {
    wsState.memberships = [two[0]];
    await mount(<WorkspacePicker />);
    expect(mockSwitchTo).toHaveBeenCalledWith('w1');
  });

  it('tells a collaborator with nothing left to ask the owner, and offers to sign out', async () => {
    wsState.memberships = [];
    const r = await mount(<WorkspacePicker />);
    expect(text(r)).toContain('You do not belong to a workspace yet');
    await act(async () => { r.root.findAll((n) => n.props?.label === 'Sign out' || n.props?.title === 'Sign out')[0]?.props.onPress?.(); });
  });
});
