import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

/**
 * The sign-in screen opened from a workspace invitation, on the phone. An address that already has a photographer
 * account gets its address filled in and a line saying who invited them; an address with no account is sent straight
 * on to sign up as a photographer with the invitation carried along; one that cannot join says so; and a link pasted
 * on the screen starts the same journey. Rendered over fakes (react-test-renderer); it never talks to a backend.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockParams: Record<string, string | undefined> = {};
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ loop: false, muted: true, play: jest.fn() }), VideoView: () => null }));
jest.mock('@/features/auth/AuthGlassLayout', () => ({ AuthGlassLayout: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/auth/GoogleButton', () => ({ GoogleButton: () => null }));
jest.mock('@/features/auth/AppleButton', () => ({ AppleButton: () => null }));
jest.mock('@/features/auth/ChooseRoleBottomSheet', () => ({ ChooseRoleBottomSheet: () => null }));
jest.mock('@/components/FindPhotosBottomSheet', () => ({ FindPhotosBottomSheet: () => null }));
jest.mock('@/features/hybrid/ExploreChoiceSheet', () => ({ ExploreChoiceSheet: () => null }));
jest.mock('@/features/hybrid/postEventIntent', () => ({ pendingPostEvent: { has: () => false, clear: jest.fn() } }));
jest.mock('@/features/auth/api', () => ({
  isNeedsPasswordChange: () => false, isNeedsTotp: () => false, isNeedsVerification: () => false,
}));
jest.mock('@/store/language', () => ({ useLanguage: () => ({ language: 'en', t: (k: string) => k }) }));
jest.mock('@/store/auth', () => ({
  isApiError: () => false,
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ login: jest.fn(), applySession: jest.fn(), user: { customerType: 'PHOTOGRAPHER' } }), { getState: () => ({ user: {} }) }),
}));
const mockMem = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockMem.get(k) ?? null,
    set: async (k: string, v: string) => { mockMem.set(k, v); },
    remove: async (k: string) => { mockMem.delete(k); },
  },
}));
const mockPreview = jest.fn();
jest.mock('./api', () => ({ getInvitePreview: (...a: unknown[]) => mockPreview(...a) }));

import LoginScreen from '@/app/(auth)/login';

const ID = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const OTHER = '9a8b7c6d-1111-4222-8333-444455556666';
const open = (o: Record<string, unknown> = {}) => ({ found: true, open: true, status: 'PENDING', ownerName: 'Aline Uwase', email: 'eric@example.com', account: 'photographer', ...o });

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const emailField = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(TextInput).find((i) => i.props.autoComplete === 'username')!;
async function mount(params: Record<string, string | undefined> = {}) {
  Object.keys(mockParams).forEach((k) => delete mockParams[k]);
  Object.assign(mockParams, params);
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<LoginScreen />); });
  await act(async () => {});
  await act(async () => {});
  return r;
}
const press = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.accessibilityLabel === label || (n.findAllByType(Text).length > 0 && text(n) === label)))[0];

beforeEach(() => {
  mockMem.clear();
  mockReplace.mockReset();
  mockPush.mockReset();
  mockPreview.mockReset();
  mockPreview.mockResolvedValue(open());
});

describe('sign-in opened from a workspace invitation', () => {
  it('fills in the invited address and says who invited them, for an address that already has an account', async () => {
    const r = await mount({ invite: ID });
    expect(text(r.root)).toContain('Aline Uwase invited you to work in their workspace');
    expect(text(r.root)).toContain('Sign in with eric@example.com');
    expect(emailField(r).props.value).toBe('eric@example.com');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sends an address with no account straight on to sign up as a photographer, carrying the invitation', async () => {
    mockPreview.mockResolvedValue(open({ account: 'none' }));
    await mount({ invite: ID });
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/signup', params: { role: 'Photographer', invite: ID } });
  });

  it('says plainly when the address belongs to an account that is not a photographer, and goes nowhere', async () => {
    mockPreview.mockResolvedValue(open({ account: 'other' }));
    const r = await mount({ invite: ID });
    expect(text(r.root)).toContain('not a photographer');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(emailField(r).props.value).toBe('');
  });

  it('says when the invitation is no longer open and leaves sign-in as it was', async () => {
    mockPreview.mockResolvedValue({ found: true, open: false, status: 'EXPIRED' });
    const r = await mount({ invite: ID });
    expect(text(r.root)).toContain('no longer open');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('picks up an invitation kept by an earlier screen, such as the app link or a restart', async () => {
    mockMem.set('connekt.pendingWorkspaceInvite', `${ID}|${Date.now()}`);
    const r = await mount();
    expect(mockPreview).toHaveBeenCalledWith(ID);
    expect(text(r.root)).toContain('Sign in with eric@example.com');
  });

  it('is plain sign-in without an invitation, and does not ask for a preview', async () => {
    const r = await mount();
    expect(mockPreview).not.toHaveBeenCalled();
    expect(text(r.root)).not.toContain('invited you');
    expect(emailField(r).props.value).toBe('');
  });

  it('starts the same journey from a link pasted on the screen, and refuses text that is not an invitation', async () => {
    mockPreview.mockResolvedValue(open({ account: 'none' }));
    const r = await mount();
    await act(async () => { press(r, 'Have a workspace invitation link?').props.onPress(); });
    const box = r.root.findAllByType(TextInput).find((i) => i.props.placeholder?.includes('Paste'))!;
    await act(async () => { box.props.onChangeText('hello there'); });
    await act(async () => { press(r, 'Continue').props.onPress(); });
    expect(text(r.root)).toContain('does not look like a workspace invitation link');
    expect(mockPreview).not.toHaveBeenCalled();
    await act(async () => { box.props.onChangeText(`https://dashboard.connekyt.com/user/photographer/collaborate?tab=workspace&invite=${OTHER}`); });
    await act(async () => { press(r, 'Continue').props.onPress(); });
    await act(async () => {});
    expect(mockPreview).toHaveBeenCalledWith(OTHER);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/signup', params: { role: 'Photographer', invite: OTHER } });
  });
});
