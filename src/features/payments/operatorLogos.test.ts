import { operatorLogo, MOMO_LOGO, CARDS_LOGO } from './operatorLogos';
import { PAYMENT_COUNTRY_LIST, paymentCountryName } from './countries';

describe('operatorLogo', () => {
  it('ships a logo for the networks we have art for', () => {
    for (const id of ['MTN', 'AIRTEL', 'MPESA', 'VODAFONE', 'ORANGE', 'TIGO']) {
      expect(operatorLogo(id)).not.toBeNull();
    }
  });

  it('returns null, never a wrong logo, for networks without art', () => {
    expect(operatorLogo('AIRTELTIGO')).toBeNull();
    expect(operatorLogo('SOMETHING_NEW')).toBeNull();
  });

  it('has the grouped Mobile Money and Cards art', () => {
    expect(MOMO_LOGO).toBeTruthy();
    expect(CARDS_LOGO).toBeTruthy();
  });
});

describe('payment countries', () => {
  it('lists Rwanda first and resolves names', () => {
    expect(PAYMENT_COUNTRY_LIST[0].iso2).toBe('RW');
    expect(paymentCountryName('ke')).toBe('Kenya');
  });
});
