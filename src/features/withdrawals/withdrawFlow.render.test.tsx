import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import WithdrawScreen from '@/app/(app)/withdraw';
import { mapSource } from './model';
import { mapAccount } from '@/features/paymentAccounts/model';

/**
 * The whole withdrawal form, rendered with react-test-renderer over a FAKE withdrawals API. Nothing here reaches a
 * backend, so this proves the screen's own behaviour (validation, the verify step, a wrong code, a refusal, a second
 * tap while sending) and is not a test of the real payout path.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockInitiate = jest.fn();
const mockVerify = jest.fn();
const mockSources = jest.fn();
const mockAccounts = jest.fn();
jest.mock('./api', () => {
  const actual = jest.requireActual('./api');
  return {
    ...actual,
    listWithdrawableSources: (...a: unknown[]) => mockSources(...a),
    getDisplayCurrencies: async () => jest.requireActual('./model').FALLBACK_CURRENCIES,
    initiateWithdrawal: (...a: unknown[]) => mockInitiate(...a),
    verifyWithdrawal: (...a: unknown[]) => mockVerify(...a),
    resendWithdrawalOtp: async () => undefined,
  };
});
jest.mock('@/features/paymentAccounts/api', () => ({ listPaymentAccounts: (...a: unknown[]) => mockAccounts(...a) }));
jest.mock('@/features/wallet/api', () => ({ listWalletMovements: async () => [] }));
jest.mock('@/features/privacy/consent', () => ({ ensureWithdrawalFaceConsent: async () => true }));
jest.mock('@/services/imagePicker', () => ({ takeSelfieDataUrl: async () => null }));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useFocusEffect: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: true, isCoordinator: false, role: 'Photographer' }) }));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { customerType: 'PHOTOGRAPHER' }, status: 'authenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const verifyStep = {
  kind: 'verify',
  verification: {
    verificationId: 'v1',
    method: 'SMS_OTP',
    maskedDestination: '+250 78* *** *11',
    requiresOtp: true,
    requiresFaceScan: false,
    fee: { totalFee: 1, percentageFee: 1, additionalCharge: 0, netAmount: 94, feePercentage: 1 },
  },
};

const text = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const pressable = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).length > 0 && text(n) === label)[0];
const press = async (r: TestRenderer.ReactTestRenderer, label: string) =>
  act(async () => {
    await pressable(r, label).props.onPress();
  });

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<WithdrawScreen />);
  });
  return r;
}
const typeAmount = async (r: TestRenderer.ReactTestRenderer, v: string) =>
  act(async () => r.root.findAllByType(TextInput)[0].props.onChangeText(v));
const enterCode = async (r: TestRenderer.ReactTestRenderer, code: string) => {
  const otp = r.root.find((n) => n.props?.label === 'Verification code' && typeof n.props.onChange === 'function');
  await act(async () => otp.props.onChange(code));
};

beforeEach(() => {
  mockInitiate.mockReset();
  mockVerify.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockBack.mockReset();
  mockSources.mockReset().mockResolvedValue([mapSource({ source: 'BALANCE', label: 'Available balance', availableBalance: 95.5 })]);
  mockAccounts.mockReset().mockResolvedValue([
    mapAccount({ id: 'm1', methodType: 'MOBILE_MONEY', accountName: 'Joseph K', accountNumber: '0788000111', bankName: 'MTN', isDefault: true }),
  ]);
});

describe('withdrawal form', () => {
  it('asks for an amount, then a donation choice, before it sends anything', async () => {
    const r = await mount();
    await press(r, 'Continue');
    expect(text(r.root)).toContain('Enter the amount to withdraw.');
    await typeAmount(r, '10');
    await press(r, 'Continue');
    expect(text(r.root)).toContain('Choose a donation, or tap "No thanks".');
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it('refuses to continue without a payment account and points to adding one', async () => {
    mockAccounts.mockResolvedValue([]);
    const r = await mount();
    expect(text(r.root)).toContain('No payment account saved yet.');
    await typeAmount(r, '10');
    await press(r, 'No thanks');
    await press(r, 'Continue');
    expect(text(r.root)).toContain('Add a payment account to receive the money.');
    expect(mockInitiate).not.toHaveBeenCalled();
    await press(r, '+ Add a payment account');
    expect(mockPush).toHaveBeenCalledWith('/payment-accounts');
  });

  it('shows the balance error with a retry instead of a zero balance when the balance cannot be read', async () => {
    mockSources.mockRejectedValueOnce({ status: 502, message: 'Could not read your balance.' });
    const r = await mount();
    expect(text(r.root)).toContain('Could not read your balance.');
    expect(pressable(r, 'Try again')).toBeTruthy();
  });
});

describe('withdrawal verification', () => {
  const toVerify = async () => {
    const r = await mount();
    await typeAmount(r, '10');
    await press(r, 'No thanks');
    mockInitiate.mockResolvedValueOnce(verifyStep);
    await press(r, 'Continue');
    return r;
  };

  it('sends the USD amount, the chosen account and the source, then shows the code step with the fee summary', async () => {
    const r = await toVerify();
    expect(mockInitiate).toHaveBeenCalledTimes(1);
    const [, input] = mockInitiate.mock.calls[0];
    expect(input.withdrawalMethodId).toBe('m1');
    expect(input.donationAmount).toBe(0);
    expect(input.source.source).toBe('BALANCE');
    expect(input.amount).toBeGreaterThan(0);
    expect(text(r.root)).toContain('Check your phone');
    expect(text(r.root)).toContain('You receive');
    expect(pressable(r, 'Confirm withdrawal')).toBeTruthy();
  });

  it('will not confirm without the full 6 digit code', async () => {
    const r = await toVerify();
    await enterCode(r, '123');
    await press(r, 'Confirm withdrawal');
    expect(text(r.root)).toContain('Enter the full 6-digit code.');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('keeps the screen and counts attempts when the code is wrong', async () => {
    const r = await toVerify();
    await enterCode(r, '123456');
    mockVerify.mockResolvedValueOnce({ kind: 'retry', message: 'That code is not correct.', remainingAttempts: 2 });
    await press(r, 'Confirm withdrawal');
    expect(text(r.root)).toContain('That code is not correct. 2 attempts left.');
    expect(pressable(r, 'Confirm withdrawal')).toBeTruthy();
    expect(text(r.root)).not.toContain('Request submitted');
  });

  it('shows the submitted result only after the backend accepts the code', async () => {
    const r = await toVerify();
    await enterCode(r, '123456');
    mockVerify.mockResolvedValueOnce({ kind: 'submitted', transactionId: 't1' });
    await press(r, 'Confirm withdrawal');
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(text(r.root)).toContain('Request submitted');
    await press(r, 'View transactions');
    expect(mockReplace).toHaveBeenCalledWith('/transactions');
  });

  it('treats a dropped connection as unknown, keeps the code and does not claim success or failure', async () => {
    const r = await toVerify();
    await enterCode(r, '123456');
    mockVerify.mockRejectedValueOnce({ status: 0, message: 'Network request failed' });
    await press(r, 'Confirm withdrawal');
    expect(text(r.root)).toContain('We could not confirm this. Check your withdrawal history before trying again.');
    expect(text(r.root)).not.toContain('Request submitted');
    expect(text(r.root)).not.toContain('Withdrawal not sent');
  });

  it('cannot send a second confirmation while the first is in flight', async () => {
    const r = await toVerify();
    await enterCode(r, '123456');
    let release!: (v: unknown) => void;
    mockVerify.mockReturnValueOnce(new Promise((res) => (release = res)));
    const confirm = pressable(r, 'Confirm withdrawal');
    await act(async () => {
      confirm.props.onPress();
    });
    const inert = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props?.disabled === true);
    expect(inert.length).toBeGreaterThan(0);
    expect(mockVerify).toHaveBeenCalledTimes(1);
    await act(async () => release({ kind: 'submitted', transactionId: 't1' }));
  });
});

describe('withdrawal refusal', () => {
  it('shows the backend reason, and a way into verification when identity is the reason', async () => {
    const r = await mount();
    await typeAmount(r, '10');
    await press(r, 'No thanks');
    mockInitiate.mockResolvedValueOnce({ kind: 'kyc', message: 'Verify your identity before you withdraw funds.' });
    await press(r, 'Continue');
    expect(text(r.root)).toContain('Verification required');
    await press(r, 'Verify identity');
    expect(mockPush).toHaveBeenCalledWith('/kyc');
  });

  it('shows a plain refusal with Try again that returns to the form', async () => {
    const r = await mount();
    await typeAmount(r, '10');
    await press(r, 'No thanks');
    mockInitiate.mockResolvedValueOnce({ kind: 'error', message: 'Withdrawals are paused for this account.' });
    await press(r, 'Continue');
    expect(text(r.root)).toContain('Withdrawals are paused for this account.');
    await press(r, 'Try again');
    expect(text(r.root)).toContain('Send your earnings to your mobile money or bank account.');
  });
});
