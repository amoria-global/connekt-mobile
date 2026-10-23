import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

/**
 * The sign-up screen opened from a workspace invitation, on the phone: the screen the whole "no account yet" journey
 * turns on. A person with no account lands on sign-up as a photographer with the invited address filled in and fixed,
 * and cannot slip back to sign-in; an address that already has an account is sent to sign in; an address that cannot
 * join says so. Rendered over fakes (react-test-renderer); it never talks to a backend.
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
jest.mock('@/features/auth/AuthGlassLayout', () => ({ AuthGlassLayout: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/auth/GoogleButton', () => ({ GoogleButton: () => null }));
jest.mock('@/features/auth/AppleButton', () => ({ AppleButton: () => null }));
jest.mock('@/components/ui/PhoneInput', () => ({ PhoneInput: () => null }));
jest.mock('@/features/auth/api', () => ({ CUSTOMER_TYPES: ['Client', 'Photographer', 'Coordinator', 'Viewer'], signup: jest.fn() }));
jest.mock('@/store/language', () => ({
  useLanguage: () => ({ language: 'en', t: (k: string) => k }),
}));
jest.mock('@/store/auth', () => ({
  isApiError: () => false,
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), { getState: () => ({ user: {} }) }),
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

import SignupScreen from '@/app/(auth)/signup';

const ID = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const open = (o: Record<string, unknown> = {}) => ({ found: true, open: true, status: 'PENDING', ownerName: 'Aline Uwase', email: 'new.person@example.com', account: 'none', ...o });

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const emailField = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(TextInput).find((i) => i.props.autoComplete === 'email')!;
async function mount(params: Record<string, string | undefined>) {
  Object.keys(mockParams).forEach((k) => delete mockParams[k]);
  Object.assign(mockParams, params);
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<SignupScreen />); });
  await act(async () => {});
  await act(async () => {});
  return r;
}

beforeEach(() => {
  mockMem.clear();
  mockReplace.mockReset();
  mockPush.mockReset();
  mockPreview.mockReset();
  mockPreview.mockResolvedValue(open());
});

describe('sign-up opened from a workspace invitation', () => {
  it('opens as a photographer sign-up with no role chosen, the invited address filled in and fixed', async () => {
    const r = await mount({ invite: ID });
    // No role was passed, but an invitation is for photographers, so it does not bounce to sign-in.
    expect(mockReplace).not.toHaveBeenCalledWith('/login');
    const all = text(r.root);
    expect(all).toContain('Aline Uwase invited you to work in their workspace');
    expect(all).toContain('Create your photographer account with new.person@example.com');
    const email = emailField(r);
    expect(email.props.value).toBe('new.person@example.com');
    expect(email.props.editable).toBe(false);
  });

  it('offers no way back to sign-in, since there is no account to sign in to', async () => {
    const r = await mount({ invite: ID });
    expect(text(r.root)).not.toContain('logIn');
    expect(text(r.root)).not.toContain('alreadyMemberSignIn');
  });

  it('keeps the invitation for the one-time code and the app restart that follow', async () => {
    await mount({ invite: ID });
    expect(mockMem.get('connekt.pendingWorkspaceInvite')).toMatch(new RegExp(`^${ID}\\|`));
  });

  it('sends an address that already has a photographer account to sign in instead', async () => {
    mockPreview.mockResolvedValue(open({ account: 'photographer' }));
    await mount({ invite: ID });
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/login', params: { invite: ID } });
  });

  it('says plainly when the address belongs to an account that is not a photographer, and fixes nothing', async () => {
    mockPreview.mockResolvedValue(open({ account: 'other' }));
    const r = await mount({ invite: ID });
    expect(text(r.root)).toContain('not a photographer');
    expect(emailField(r).props.editable).not.toBe(false);
    expect(mockReplace).not.toHaveBeenCalledWith({ pathname: '/login', params: { invite: ID } });
  });

  it('says when the invitation is no longer open, and leaves sign-up as it was', async () => {
    mockPreview.mockResolvedValue({ found: true, open: false, status: 'CANCELLED' });
    const r = await mount({ invite: ID });
    expect(text(r.root)).toContain('no longer open');
    expect(emailField(r).props.editable).not.toBe(false);
  });

  it('carries on as plain sign-up when the preview cannot be read', async () => {
    mockPreview.mockResolvedValue(null);
    const r = await mount({ invite: ID });
    expect(text(r.root)).not.toContain('invited you');
    expect(emailField(r).props.editable).not.toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('ignores an invitation when the person chose another role, and does not fix their email', async () => {
    const r = await mount({ role: 'Client', invite: ID });
    expect(text(r.root)).not.toContain('invited you');
    expect(emailField(r).props.editable).not.toBe(false);
  });

  it('is unchanged without an invitation: the chosen role, an editable email and the sign-in link', async () => {
    const r = await mount({ role: 'Photographer' });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(emailField(r).props.editable).not.toBe(false);
    expect(text(r.root)).toContain('logIn');
  });

  it('still sends a visitor with neither a role nor an invitation back to sign-in', async () => {
    await mount({});
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('ignores a kept invitation from an earlier visit: only the route counts on this screen', async () => {
    mockMem.set('connekt.pendingWorkspaceInvite', `${ID}|${Date.now()}`);
    const r = await mount({ role: 'Photographer' });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(text(r.root)).not.toContain('invited you');
  });
});
