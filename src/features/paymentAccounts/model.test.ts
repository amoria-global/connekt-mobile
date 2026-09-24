import { mapAccount, maskAccountNumber, MOBILE_PROVIDER, resolveMobileName, withdrawalMethodsPath } from './model';

/**
 * Saved payment accounts, mirrored from the web dashboard's Preferences >
 * Payment Accounts tab. These pin the decisions that decide where a user's
 * money is paid out.
 */
describe('withdrawalMethodsPath', () => {
  it('uses the photographer namespace only for photographers, as the web does', () => {
    expect(withdrawalMethodsPath('Photographer')).toBe('/photographer/withdrawal-methods');
    expect(withdrawalMethodsPath('Coordinator')).toBe('/customer/withdrawal-methods');
    expect(withdrawalMethodsPath('Client')).toBe('/customer/withdrawal-methods');
    expect(withdrawalMethodsPath(undefined)).toBe('/customer/withdrawal-methods');
  });
});

describe('mapAccount', () => {
  it('reads a bank transfer row', () => {
    expect(
      mapAccount({
        id: 'a1',
        methodType: 'BANK_TRANSFER',
        bankName: 'Bank of Kigali',
        accountNumber: '000123456789',
        accountName: 'Jane Doe',
        isDefault: true,
      }),
    ).toEqual({
      id: 'a1',
      kind: 'bank',
      methodType: 'BANK_TRANSFER',
      label: 'Bank of Kigali',
      accountNumber: '000123456789',
      accountName: 'Jane Doe',
      bankName: 'Bank of Kigali',
      isDefault: true,
    });
  });

  it('tells Airtel from MTN by the stored provider name, like the web', () => {
    expect(mapAccount({ id: 'x', methodType: 'MOBILE_MONEY', bankName: 'Airtel Rwanda' }).kind).toBe('airtel');
    expect(mapAccount({ id: 'x', methodType: 'mobile_money', bankName: 'MTN Mobile Money' }).kind).toBe('mtn');
    expect(mapAccount({ id: 'x', methodType: 'MOBILE_MONEY' }).label).toBe('MTN Mobile Money');
  });

  it('only treats a literal true as the default', () => {
    expect(mapAccount({ id: 'x', isDefault: 'true' }).isDefault).toBe(false);
  });
});

describe('MOBILE_PROVIDER', () => {
  it('keeps the XentriPay ids and stored names the web sends', () => {
    expect(MOBILE_PROVIDER.mtn).toEqual({ bankId: '63510', bankName: 'MTN Mobile Money' });
    // "Airtel Rwanda" contains "airtel", which is how the row is read back as Airtel.
    expect(MOBILE_PROVIDER.airtel).toEqual({ bankId: '63514', bankName: 'Airtel Rwanda' });
  });
});

describe('resolveMobileName', () => {
  it('keeps the typed name when the network returned none', () => {
    expect(resolveMobileName(' Jane Doe ', '')).toEqual({ name: 'Jane Doe', needsConfirm: false });
  });

  it('saves the registered name when nothing or the same name was typed', () => {
    expect(resolveMobileName('', 'JANE DOE')).toEqual({ name: 'JANE DOE', needsConfirm: false });
    expect(resolveMobileName('jane doe', 'JANE DOE')).toEqual({ name: 'JANE DOE', needsConfirm: false });
  });

  it('asks before saving when the names differ, then saves the registered one', () => {
    expect(resolveMobileName('John Roe', 'JANE DOE')).toEqual({ name: 'JANE DOE', needsConfirm: true });
  });

  it('returns an empty name when there is neither, so the form asks for one', () => {
    expect(resolveMobileName('  ', '')).toEqual({ name: '', needsConfirm: false });
  });
});

describe('maskAccountNumber', () => {
  it('shows only the last four digits', () => {
    expect(maskAccountNumber('250788123456')).toBe('•••• 3456');
    expect(maskAccountNumber('1234')).toBe('1234');
  });
});
