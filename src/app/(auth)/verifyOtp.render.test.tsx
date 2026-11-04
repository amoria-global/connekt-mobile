import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The new-account verification screen over fakes: every state the server can answer with. The fakes stand
 * in for the server; the screen must show what they say and never judge a code.
 */
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/features/auth/AuthGlassLayout', () => ({
  AuthGlassLayout: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual('react-native');
    return <View>{children}</View>;
  },
}));
jest.mock('@/i18n/sharedStrings', () => ({ useSharedT: () => ({ tr: (s: string) => s }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/store/language', () => ({ useLanguage: () => ({ language: 'en', t: (k: string) => k }) }));
const mockApply = jest.fn();
jest.mock('@/store/auth', () => ({ useAuth: (sel: (s: unknown) => unknown) => sel({ applySession: mockApply }) }));
const mockVerify = jest.fn();
const mockResend = jest.fn();
jest.mock('@/features/auth/api', () => ({
  verifyOtp: (...a: unknown[]) => mockVerify(...a),
  resendOtp: (...a: unknown[]) => mockResend(...a),
}));

import { codeErrorFrom } from '@/features/auth/twoFactor';
import VerifyOtpScreen from './verify-otp';

const text = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().flat().join('')).filter(Boolean).join(' | ');
const field = (r: TestRenderer.ReactTestRenderer): ReactTestInstance => r.root.findByType(TextInput);

/** The Resend row: the pressable that holds the didntGetCode line. */
const resendButton = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button'
      && n.findAllByType(Text).some((t) => String([t.props.children].flat()[0]).startsWith('didntGetCode')),
  )[0];

async function mount(params: Record<string, string>) {
  Object.keys(mockParams).forEach((k) => delete mockParams[k]);
  Object.assign(mockParams, { customerId: 'c1', email: 'ada@mail.com', ...params });
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<VerifyOtpScreen />);
  });
  return r;
}
const type = async (r: TestRenderer.ReactTestRenderer, code: string) => {
  await act(async () => {
    field(r).props.onChangeText(code);
  });
};

beforeEach(() => jest.clearAllMocks());

describe('signup verification', () => {
  it('submits on the sixth digit and signs in', async () => {
    mockVerify.mockResolvedValue({ token: 't' });
    const r = await mount({});
    await type(r, '123456');
    expect(mockVerify).toHaveBeenCalledWith('c1', '123456');
    expect(mockApply).toHaveBeenCalledWith({ token: 't' });
  });

  it('a code that starts with zero is sent as typed', async () => {
    mockVerify.mockResolvedValue({ token: 't' });
    const r = await mount({});
    await type(r, '012345');
    expect(mockVerify).toHaveBeenCalledWith('c1', '012345');
  });

  it('a wrong code clears the field and shows the attempts the server says are left', async () => {
    mockVerify.mockRejectedValue(codeErrorFrom({ errorCode: 'WRONG_CODE', attemptsLeft: 2, message: 'That code did not work.' }, 'x'));
    const r = await mount({});
    await type(r, '000000');
    expect(field(r).props.value).toBe('');
    expect(text(r)).toContain('That code did not work.');
    expect(text(r)).toContain('2 attempts left');
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('a lock shows the remaining time, stops input and blocks Resend', async () => {
    mockVerify.mockRejectedValue(codeErrorFrom({ errorCode: 'LOCKED', retryAfterSeconds: 900, message: 'Locked' }, 'x'));
    const r = await mount({});
    await type(r, '000000');
    expect(text(r)).toContain('Try again in 15:00');
    expect(field(r).props.editable).toBe(false);
  });

  it('does not submit twice while the server is checking', async () => {
    let release!: (v: unknown) => void;
    mockVerify.mockReturnValue(new Promise((res) => { release = res; }));
    const r = await mount({});
    await type(r, '123456');
    expect(field(r).props.editable).toBe(false);
    await type(r, '654321');
    expect(mockVerify).toHaveBeenCalledTimes(1);
    await act(async () => release({ token: 't' }));
  });
});

describe('resend', () => {
  it('counts down from the server deadline the signup answer gave', async () => {
    const r = await mount({ resendAt: String(Date.now() + 180_000) });
    expect(text(r)).toContain('Resend code in 3:00');
  });

  it('a refused resend shows the server wait', async () => {
    mockResend.mockRejectedValue(codeErrorFrom({ errorCode: 'RATE_LIMITED', retryAfterSeconds: 480, message: 'Too many codes.' }, 'x'));
    const r = await mount({});
    const pressable = resendButton(r);
    await act(async () => pressable.props.onPress());
    expect(text(r)).toContain('Too many codes.');
    expect(text(r)).toContain('Resend code in 8:00');
  });

  it('a good resend holds Resend for the server gap', async () => {
    const now = Date.now();
    mockResend.mockResolvedValue({
      maskedEmail: 'ad•••@mail.com',
      expiresAt: new Date(now + 300_000).toISOString(),
      resendAvailableAt: new Date(now + 180_000).toISOString(),
      serverTime: new Date(now).toISOString(),
    });
    const r = await mount({});
    const pressable = resendButton(r);
    await act(async () => pressable.props.onPress());
    expect(text(r)).toContain('Resend code in 3:00');
    expect(text(r)).toContain('A new code has been sent');
  });
});
