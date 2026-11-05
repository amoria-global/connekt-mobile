import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The sign-in code screen over fakes: every state the server can answer with. The fakes stand in for the
 * server; the screen must show what they say (attempts left, lock time, resend wait) and never judge a code.
 */
const mockParams: Record<string, string> = {};
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/features/auth/AuthGlassLayout', () => ({
  AuthGlassLayout: ({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) => {
    const { Text: T, View } = jest.requireActual('react-native');
    return <View><T>{subtitle}</T>{children}</View>;
  },
}));
jest.mock('@/i18n/sharedStrings', () => ({ useSharedT: () => ({ tr: (s: string) => s }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/store/language', () => ({ useLanguage: () => ({ language: 'en', t: (k: string) => k }) }));
const mockApply = jest.fn();
jest.mock('@/store/auth', () => ({
  useAuth: (sel: (s: unknown) => unknown) => sel({ applySession: mockApply }),
}));
const mockVerify = jest.fn();
jest.mock('@/features/auth/api', () => ({ verifySecondFactor: (...a: unknown[]) => mockVerify(...a) }));
const mockSend = jest.fn();
jest.mock('@/features/auth/twoFactor', () => ({
  ...jest.requireActual('@/features/auth/twoFactor'),
  sendEmailCode: (...a: unknown[]) => mockSend(...a),
}));

import { codeErrorFrom } from '@/features/auth/twoFactor';
import VerifyTotpScreen from '@/app/(auth)/verify-totp';

const sent = (resendInSeconds = 180) => ({
  maskedEmail: 'jo•••@mail.com',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAvailableAt: new Date(Date.now() + resendInSeconds * 1000).toISOString(),
  serverTime: new Date().toISOString(),
});

const text = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const field = (r: TestRenderer.ReactTestRenderer): ReactTestInstance => r.root.findByType(TextInput);

async function mount(params: Record<string, string>) {
  Object.keys(mockParams).forEach((k) => delete mockParams[k]);
  Object.assign(mockParams, { customerId: 'c1', challengeId: 'p.sig', ...params });
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<VerifyTotpScreen />);
  });
  return r;
}
const type = async (r: TestRenderer.ReactTestRenderer, code: string) => {
  await act(async () => {
    field(r).props.onChangeText(code);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authenticator sign-in', () => {
  it('submits on the sixth digit with the signed challenge and signs in', async () => {
    mockVerify.mockResolvedValue({ token: 't' });
    const r = await mount({ methods: 'TOTP', defaultMethod: 'TOTP' });
    await type(r, '123456');
    expect(mockVerify).toHaveBeenCalledWith('TOTP', expect.objectContaining({ challengeId: 'p.sig' }), '123456');
    expect(mockApply).toHaveBeenCalledWith({ token: 't' });
  });

  it('a wrong code clears the field and shows the attempts the server says are left', async () => {
    mockVerify.mockRejectedValue(codeErrorFrom({ errorCode: 'WRONG_CODE', attemptsLeft: 2, message: 'That code is not right.' }, 'x'));
    const r = await mount({ methods: 'TOTP', defaultMethod: 'TOTP' });
    await type(r, '000000');
    expect(field(r).props.value).toBe('');
    expect(text(r)).toContain('That code is not right.');
    expect(text(r)).toContain('2 attempts left');
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('a lock shows the remaining time and stops input', async () => {
    mockVerify.mockRejectedValue(codeErrorFrom({ errorCode: 'LOCKED', retryAfterSeconds: 900, message: 'Locked' }, 'x'));
    const r = await mount({ methods: 'TOTP', defaultMethod: 'TOTP' });
    await type(r, '000000');
    expect(text(r)).toContain('Try again in 15:00');
    expect(field(r).props.editable).toBe(false);
  });

  it('an expired session goes back to sign-in without saying why', async () => {
    mockVerify.mockRejectedValue(codeErrorFrom({ errorCode: 'SESSION_EXPIRED', message: 'Session expired' }, 'x'));
    const r = await mount({ methods: 'TOTP', defaultMethod: 'TOTP' });
    await type(r, '123456');
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('locks the field while the server checks so a second submit cannot start', async () => {
    let release!: (v: unknown) => void;
    mockVerify.mockReturnValue(new Promise((res) => { release = res; }));
    const r = await mount({ methods: 'TOTP', defaultMethod: 'TOTP' });
    await type(r, '123456');
    expect(field(r).props.editable).toBe(false);
    await type(r, '654321');
    expect(mockVerify).toHaveBeenCalledTimes(1);
    await act(async () => release({ token: 't' }));
  });

  it('shows no method switcher when the account has only the authenticator', async () => {
    const r = await mount({ methods: 'TOTP', defaultMethod: 'TOTP' });
    expect(text(r)).not.toContain('Email code');
  });
});

describe('email sign-in', () => {
  it('asks for the code once on arrival, names the address and disables Resend until the timer ends', async () => {
    mockSend.mockResolvedValue(sent(180));
    const r = await mount({ methods: 'TOTP,EMAIL', defaultMethod: 'EMAIL' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('p.sig');
    expect(text(r)).toContain('jo•••@mail.com');
    expect(text(r)).toContain('Resend code in 3:00');
  });

  it('verifies through the email endpoint', async () => {
    mockSend.mockResolvedValue(sent());
    mockVerify.mockResolvedValue({ token: 't' });
    const r = await mount({ methods: 'TOTP,EMAIL', defaultMethod: 'EMAIL' });
    await type(r, '123456');
    expect(mockVerify).toHaveBeenCalledWith('EMAIL', expect.anything(), '123456');
  });

  it('a rate limit shows the server wait on the Resend button', async () => {
    mockSend.mockRejectedValue(codeErrorFrom({ errorCode: 'RATE_LIMITED', retryAfterSeconds: 480, message: 'Too many codes' }, 'x'));
    const r = await mount({ methods: 'TOTP,EMAIL', defaultMethod: 'EMAIL' });
    expect(text(r)).toContain('Too many codes');
    expect(text(r)).toContain('Resend code in 8:00');
  });

  it('a lock on the authenticator does not block the email code, and comes back with its tab', async () => {
    mockSend.mockResolvedValue(sent());
    mockVerify.mockRejectedValue(codeErrorFrom({ errorCode: 'LOCKED', retryAfterSeconds: 900, message: 'Locked' }, 'x'));
    const r = await mount({ methods: 'TOTP,EMAIL', defaultMethod: 'TOTP' });
    await type(r, '000000');
    expect(field(r).props.editable).toBe(false);
    const press = async (label: string) => {
      const btn = r.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => [t.props.children].flat().join('') === label))[0];
      await act(async () => btn.props.onPress());
    };
    await press('Email code');
    expect(field(r).props.editable).toBe(true);
    expect(text(r)).not.toContain('Too many wrong codes');
  });
});
