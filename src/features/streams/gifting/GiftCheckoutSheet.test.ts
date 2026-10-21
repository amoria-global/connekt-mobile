import { buildAuthGiftRequest, buildGiftRequest } from './GiftCheckoutSheet';

jest.mock('@/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));
jest.mock('@/utils/deviceId', () => ({ getDeviceId: jest.fn() }));
jest.mock('@/features/photos/api', () => ({ getPublicPaymentStatus: jest.fn() }));
jest.mock('@/features/payments/CheckoutSheet', () => ({ CheckoutSheet: () => null }));
jest.mock('@/features/streams/gifting/GiftOverlay', () => ({ formatGiftUsd: (n: number) => `$${n}` }));

const gift = { code: 'LION', name: 'Lion', emoji: 'L', amountUsd: 50 } as never;
const base = { currencyId: 'usd-id-from-backend', viewerId: 'v1', deviceFingerprint: 'fp', gift };

describe('buildGiftRequest', () => {
  it('prices by gift code and never invents a phone for a card', () => {
    const r = buildGiftRequest({ ...base, input: { card: true } });
    expect(r.giftCode).toBe('LION');
    expect(r.paymentMethod).toBe('CARD');
    expect(r.phone).toBeUndefined();
    expect(r.telecomProvider).toBeUndefined();
  });

  it('sends the E.164 phone and passes the provider through untouched', () => {
    const r = buildGiftRequest({ ...base, input: { card: false, phone: '250781234567', telecomProvider: 'AIRTEL' } });
    expect(r.paymentMethod).toBe('MOMO');
    expect(r.phone).toBe('250781234567');
    expect(r.telecomProvider).toBe('AIRTEL');
  });

  it('never rewrites an M-Pesa number onto MTN', () => {
    const r = buildGiftRequest({ ...base, input: { card: false, phone: '254712345678', telecomProvider: 'MPESA' } });
    expect(r.telecomProvider).toBe('MPESA');
  });
});

describe('buildAuthGiftRequest', () => {
  it('carries the currency id it is given, never one of its own', () => {
    const r = buildAuthGiftRequest({ currencyId: 'usd-id-from-backend', eventId: 'e1', gift, input: { card: true } });
    expect(r.currencyId).toBe('usd-id-from-backend');
    expect(buildGiftRequest({ ...base, input: { card: true } }).currencyId).toBe('usd-id-from-backend');
  });
  it('names the gift, never an amount, and no viewer or device for a signed-in sender', () => {
    const r = buildAuthGiftRequest({ currencyId: 'c', eventId: 'e1', gift, input: { card: false, phone: '254712345678', telecomProvider: 'MPESA' } });
    expect(r).toEqual(expect.objectContaining({ eventId: 'e1', giftCode: 'LION', paymentMethod: 'MOBILE_MONEY', telecomProvider: 'MPESA' }));
    expect(r).not.toHaveProperty('amount');
    expect(r).not.toHaveProperty('viewerId');
  });
  it('sends no phone for a card', () => {
    const r = buildAuthGiftRequest({ currencyId: 'c', eventId: 'e1', gift, input: { card: true } });
    expect(r.paymentMethod).toBe('CARD');
    expect(r.phone).toBeUndefined();
  });
});
