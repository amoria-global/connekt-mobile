/**
 * Logos for the payment method pickers. The backend sends operators as
 * { id, name, type } with no icon key, so the logo is matched from the id.
 * An operator with no shipped logo gets null and the picker draws initials,
 * never a broken image.
 */
import type { ImageSourcePropType } from 'react-native';

export const MOMO_LOGO: ImageSourcePropType = require('../../../assets/images/momo.jpeg');
export const CARDS_LOGO: ImageSourcePropType = require('../../../assets/images/payments/cards.png');

export function operatorLogo(id: string): ImageSourcePropType | null {
  const k = (id || '').toLowerCase();
  if (k.includes('mpesa') || k.includes('m-pesa')) return require('../../../assets/images/payments/mpesa.png');
  if (k.startsWith('mtn')) return require('../../../assets/images/payments/mtn.png');
  if (k.includes('airteltigo')) return null;
  if (k.startsWith('airtel')) return require('../../../assets/images/payments/airtel.png');
  if (k.includes('vodafone')) return require('../../../assets/images/payments/vodafone.png');
  if (k.startsWith('orange')) return require('../../../assets/images/payments/orange.png');
  if (k.includes('tigo')) return require('../../../assets/images/payments/tigo.png');
  return null;
}
