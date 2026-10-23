/**
 * Role-aware money formatting layer.
 * Direct mobile port of salo-run/lib/moneyView.ts.
 */
import type { WalletDTO, Movement } from './api';
import { useLanguage } from '@/store/language';

const MONEY_TRANSLATIONS: Record<'fr' | 'es' | 'rw' | 'sw', Record<string, string>> = {
  fr: {
    'Booking earnings': 'Revenus de réservation',
    'Booking payment': 'Paiement de réservation',
    'Event payment': "Paiement d'événement",
    Balance: 'Solde',
    Booking: 'Réservation',
    'Tip received': 'Pourboire reçu',
    'Tip sent': 'Pourboire envoyé',
    Tip: 'Pourboire',
    'Bonus earned': 'Bonus gagné',
    Bonus: 'Bonus',
    'Gift received': 'Cadeau reçu',
    'Gift sent': 'Cadeau envoyé',
    Gift: 'Cadeau',
    'Stream bonus': 'Bonus de diffusion',
    'Stream revenue': 'Revenus de diffusion',
    'Stream payment': 'Paiement de diffusion',
    'Stream fee': 'Frais de diffusion',
    Stream: 'Diffusion',
    'Donation received': 'Don reçu',
    'Donation sent': 'Don envoyé',
    Donation: 'Don',
    Withdrawal: 'Retrait',
    'Refund issued': 'Remboursement émis',
    'Refund received': 'Remboursement reçu',
    Refund: 'Remboursement',
    'Client payment': 'Paiement client',
    'Payment sent': 'Paiement envoyé',
    'Client spend': 'Dépense client',
    Payment: 'Paiement',
    'Ad revenue share': 'Part des revenus publicitaires',
    'Ad revenue': 'Revenus publicitaires',
    'Photo sale': 'Vente de photo',
    'Photo purchase': 'Achat de photo',
    Photo: 'Photo',
    'Platform fee': 'Frais de plateforme',
    Fee: 'Frais',
    'Held for delivery': 'Retenu pour livraison',
    'Held in escrow': 'Retenu en séquestre',
    Held: 'Retenu',
    'Pending clearance': 'En attente de compensation',
    Processing: 'En traitement',
    Pending: 'En attente',
    Blocked: 'Bloqué',
    'Balance deduction': 'Déduction de solde',
    'Balance correction': 'Correction de solde',
    Other: 'Autre',
    'Available to withdraw': 'Disponible pour retrait',
    Tips: 'Pourboires',
    Bonuses: 'Bonus',
    'Album sales': "Ventes d'albums",
    Gifts: 'Cadeaux',
    Donations: 'Dons',
    'In escrow': 'En séquestre',
    'Total withdrawn': 'Total retiré',
    'Total spent': 'Total dépensé',
    'Available balance': 'Solde disponible',
    'Refunds received': 'Remboursements reçus',
    'Event spend': "Dépenses d'événement",
    All: 'Tout',
    'Earnings (+)': 'Revenus (+)',
    Withdrawals: 'Retraits',
    'Money in (+)': 'Entrées (+)',
    'Money out (−)': 'Sorties (−)',
  },
  es: {
    'Booking earnings': 'Ingresos por reservas',
    'Booking payment': 'Pago de reserva',
    'Event payment': 'Pago de evento',
    Balance: 'Saldo',
    Booking: 'Reserva',
    'Tip received': 'Propina recibida',
    'Tip sent': 'Propina enviada',
    Tip: 'Propina',
    'Bonus earned': 'Bono ganado',
    Bonus: 'Bono',
    'Gift received': 'Regalo recibido',
    'Gift sent': 'Regalo enviado',
    Gift: 'Regalo',
    'Stream bonus': 'Bono de transmisión',
    'Stream revenue': 'Ingresos de transmisión',
    'Stream payment': 'Pago de transmisión',
    'Stream fee': 'Tarifa de transmisión',
    Stream: 'Transmisión',
    'Donation received': 'Donación recibida',
    'Donation sent': 'Donación enviada',
    Donation: 'Donación',
    Withdrawal: 'Retiro',
    'Refund issued': 'Reembolso emitido',
    'Refund received': 'Reembolso recibido',
    Refund: 'Reembolso',
    'Client payment': 'Pago de cliente',
    'Payment sent': 'Pago enviado',
    'Client spend': 'Gasto de cliente',
    Payment: 'Pago',
    'Ad revenue share': 'Participación de ingresos publicitarios',
    'Ad revenue': 'Ingresos publicitarios',
    'Photo sale': 'Venta de foto',
    'Photo purchase': 'Compra de foto',
    Photo: 'Foto',
    'Platform fee': 'Tarifa de plataforma',
    Fee: 'Tarifa',
    'Held for delivery': 'Retenido para entrega',
    'Held in escrow': 'En garantía',
    Held: 'Retenido',
    'Pending clearance': 'Pendiente de liquidación',
    Processing: 'Procesando',
    Pending: 'Pendiente',
    Blocked: 'Bloqueado',
    'Balance deduction': 'Deducción de saldo',
    'Balance correction': 'Corrección de saldo',
    Other: 'Otro',
    'Available to withdraw': 'Disponible para retirar',
    Tips: 'Propinas',
    Bonuses: 'Bonos',
    'Album sales': 'Ventas de álbumes',
    Gifts: 'Regalos',
    Donations: 'Donaciones',
    'In escrow': 'En garantía',
    'Total withdrawn': 'Total retirado',
    'Total spent': 'Total gastado',
    'Available balance': 'Saldo disponible',
    'Refunds received': 'Reembolsos recibidos',
    'Event spend': 'Gasto de eventos',
    All: 'Todo',
    'Earnings (+)': 'Ingresos (+)',
    Withdrawals: 'Retiros',
    'Money in (+)': 'Entradas (+)',
    'Money out (−)': 'Salidas (−)',
  },
  rw: {
    'Booking earnings': 'Inyungu z’imyanya yafashwe',
    'Booking payment': 'Ubwishyu bw’umwanya wafashwe',
    'Event payment': 'Ubwishyu bw’igikorwa',
    Balance: 'Amafaranga ariho',
    Booking: 'Gufata umwanya',
    'Tip received': 'Ishimwe ryakiriwe',
    'Tip sent': 'Ishimwe ryoherejwe',
    Tip: 'Ishimwe',
    'Bonus earned': 'Inyongera yabonetse',
    Bonus: 'Inyongera',
    'Gift received': 'Impano yakiriwe',
    'Gift sent': 'Impano yoherejwe',
    Gift: 'Impano',
    'Stream bonus': 'Inyongera ya Live',
    'Stream revenue': 'Inyungu ya Live',
    'Stream payment': 'Ubwishyu bwa Live',
    'Stream fee': 'Ikiguzi cya Live',
    Stream: 'Imbonankubone',
    'Donation received': 'Inkunga yakiriwe',
    'Donation sent': 'Inkunga yoherejwe',
    Donation: 'Inkunga',
    Withdrawal: 'Kubikuza',
    'Refund issued': 'Amafaranga yasubijwe',
    'Refund received': 'Amafaranga yasubijwe yakiriwe',
    Refund: 'Gusubizwa amafaranga',
    'Client payment': 'Ubwishyu bw’umukiriya',
    'Payment sent': 'Ubwishyu bwoherejwe',
    'Client spend': 'Ayakoreshejwe n’umukiriya',
    Payment: 'Ubwishyu',
    'Ad revenue share': 'Umugabane ku nyungu z’amamaza',
    'Ad revenue': 'Inyungu z’amamaza',
    'Photo sale': 'Igurishwa ry’ifoto',
    'Photo purchase': 'Igura ry’ifoto',
    Photo: 'Ifoto',
    'Platform fee': 'Ikiguzi cy’urubuga',
    Fee: 'Ikiguzi',
    'Held for delivery': 'Yabitswe kugeza amafoto atanzwe',
    'Held in escrow': 'Ari mu bubiko bwizewe (Escrow)',
    Held: 'Yabitswe',
    'Pending clearance': 'Ategereje kwemezwa',
    Processing: 'Birimo gukorwa',
    Pending: 'Bitegereje',
    Blocked: 'Byahagaritswe',
    'Balance deduction': 'Igabanywa ku mafaranga ariho',
    'Balance correction': 'Isuzuma ry’amafaranga ariho',
    Other: 'Ibindi',
    'Available to withdraw': 'Ashobora kubikuzwa',
    Tips: 'Amashimwe',
    Bonuses: 'Inyongera',
    'Album sales': 'Igurishwa rya alubumu',
    Gifts: 'Impano',
    Donations: 'Inkunga',
    'In escrow': 'Mu bubiko bwizewe (Escrow)',
    'Total withdrawn': 'Ayabikujwe yose',
    'Total spent': 'Ayakoreshejwe yose',
    'Available balance': 'Amafaranga aboneka',
    'Refunds received': 'Ayasubijwe yakiriwe',
    'Event spend': 'Ayakoreshejwe mu birori',
    All: 'Byose',
    'Earnings (+)': 'Inyungu (+)',
    Withdrawals: 'Kubikuza',
    'Money in (+)': 'Ayinjiye (+)',
    'Money out (−)': 'Ayasohotse (−)',
  },
  sw: {
    'Booking earnings': 'Mapato ya nafasi',
    'Booking payment': 'Malipo ya nafasi',
    'Event payment': 'Malipo ya tukio',
    Balance: 'Salio',
    Booking: 'Nafasi',
    'Tip received': 'Bakshishi iliyopokelewa',
    'Tip sent': 'Bakshishi iliyotumwa',
    Tip: 'Bakshishi',
    'Bonus received': 'Bonasi iliyopokelewa',
    'Bonus sent': 'Bonasi iliyotumwa',
    Bonus: 'Bonasi',
    'Gift received': 'Zawadi iliyopokelewa',
    'Gift sent': 'Zawadi iliyotumwa',
    Gift: 'Zawadi',
    'Stream bonus': 'Bonasi ya utiririshaji',
    'Stream revenue': 'Mapato ya utiririshaji',
    'Stream payment': 'Malipo ya utiririshaji',
    'Stream fee': 'Ada ya utiririshaji',
    Stream: 'Utiririshaji',
    'Donation received': 'Mchango uliopokelewa',
    'Donation sent': 'Mchango uliotumwa',
    Donation: 'Mchango',
    Withdrawal: 'Kutoa fedha',
    'Refund issued': 'Marejesho yametolewa',
    'Refund received': 'Marejesho yamepokelewa',
    Refund: 'Marejesho',
    'Client payment': 'Malipo ya mteja',
    'Payment sent': 'Malipo yametumwa',
    'Client spend': 'Matumizi ya mteja',
    Payment: 'Malipo',
    'Ad revenue share': 'Gawio la matangazo',
    'Ad revenue': 'Mapato ya matangazo',
    'Photo sale': 'Mauzo ya picha',
    'Photo purchase': 'Ununuzi wa picha',
    Photo: 'Picha',
    'Platform fee': 'Ada ya jukwaa',
    Fee: 'Ada',
    'Held for delivery': 'Imeshikiliwa kusubiri uwasilishaji',
    'Held in escrow': 'Imeshikiliwa kwenye dhamana (Escrow)',
    Held: 'Imeshikiliwa',
    'Pending clearance': 'Inasubiri idhini',
    Processing: 'Inashughulikiwa',
    Pending: 'Inasubiri',
    Blocked: 'Imezuiwa',
    'Balance deduction': 'Punguzo la salio',
    'Balance correction': 'Marekebisho ya salio',
    Other: 'Nyinginezo',
    'Available to withdraw': 'Inapatikana kutoa',
    Tips: 'Bakshishi',
    Bonuses: 'Bonasi',
    'Album sales': 'Mauzo ya albamu',
    Gifts: 'Zawadi',
    Donations: 'Michango',
    'In escrow': 'Kwenye dhamana (Escrow)',
    'Total withdrawn': 'Jumla iliyotolewa',
    'Total spent': 'Jumla iliyotumika',
    'Available balance': 'Salio lililopo',
    'Refunds received': 'Marejesho yaliyopokelewa',
    'Event spend': 'Matumizi ya tukio',
    All: 'Yote',
    'Earnings (+)': 'Mapato (+)',
    Withdrawals: 'Kutoa fedha',
    'Money in (+)': 'Pesa iliyoingia (+)',
    'Money out (−)': 'Pesa iliyotoka (−)',
  },
};

import { translateSharedRw } from '@/i18n/kinyarwanda';
import { translateSharedSw } from '@/i18n/swahili';

function trMoney(text: string): string {
  const lang = useLanguage.getState().language;
  if (lang === 'en') return text;
  const hit = MONEY_TRANSLATIONS[lang]?.[text];
  if (hit) return hit;
  if (lang === 'rw') return translateSharedRw(text);
  if (lang === 'sw') return translateSharedSw(text);
  return text;
}

export function translateMoneyTag(tag: string): string {
  return trMoney(tag);
}

export type DashboardRole =
  | 'photographer'
  | 'client'
  | 'event-coordinator'
  | 'admin'
  | 'user';

export function toRole(customerType: string | undefined | null): DashboardRole {
  if (!customerType) return 'client';
  const lower = customerType.toLowerCase().replace(/_/g, '-');
  if (lower === 'photographer' || lower === 'videographer') return 'photographer';
  if (lower === 'event-coordinator') return 'event-coordinator';
  if (lower === 'admin') return 'admin';
  if (lower === 'user') return 'user';
  return 'client';
}

export interface MoneyItem {
  id: string;
  title: string;
  subtitle?: string;
  amount: number;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  direction: 'in' | 'out';
  color: 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'neutral';
  timestamp: string;
  tag: string;
  sourceType?: string;
  sourceId?: string | null;
}

interface CategoryMeta {
  label: Record<string, string>;
  tag: string;
  color: MoneyItem['color'];
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  BALANCE: {
    label: {
      photographer: 'Booking earnings',
      client: 'Booking payment',
      'event-coordinator': 'Event payment',
      user: 'Booking payment',
      admin: 'Balance',
    },
    tag: 'Booking',
    color: 'green',
  },
  TIPS: {
    label: {
      photographer: 'Tip received',
      client: 'Tip sent',
      'event-coordinator': 'Tip sent',
      user: 'Tip sent',
      admin: 'Tip',
    },
    tag: 'Tip',
    color: 'purple',
  },
  BONUSES: {
    label: {
      photographer: 'Bonus earned',
      client: 'Bonus',
      'event-coordinator': 'Bonus',
      user: 'Bonus',
      admin: 'Bonus',
    },
    tag: 'Bonus',
    color: 'amber',
  },
  GIFTS: {
    label: {
      photographer: 'Gift received',
      client: 'Gift sent',
      'event-coordinator': 'Gift sent',
      user: 'Gift sent',
      admin: 'Gift',
    },
    tag: 'Gift',
    color: 'purple',
  },
  STREAM_FEES: {
    label: {
      photographer: 'Stream bonus',
      client: 'Stream revenue',
      'event-coordinator': 'Stream revenue',
      user: 'Stream payment',
      admin: 'Stream fee',
    },
    tag: 'Stream',
    color: 'blue',
  },
  DONATIONS: {
    label: {
      photographer: 'Donation received',
      client: 'Donation sent',
      'event-coordinator': 'Donation sent',
      user: 'Donation sent',
      admin: 'Donation',
    },
    tag: 'Donation',
    color: 'purple',
  },
  WITHDRAWAL: {
    label: {
      photographer: 'Withdrawal',
      client: 'Withdrawal',
      'event-coordinator': 'Withdrawal',
      user: 'Withdrawal',
      admin: 'Withdrawal',
    },
    tag: 'Withdrawal',
    color: 'red',
  },
  REFUND: {
    label: {
      photographer: 'Refund issued',
      client: 'Refund received',
      'event-coordinator': 'Refund received',
      user: 'Refund received',
      admin: 'Refund',
    },
    tag: 'Refund',
    color: 'amber',
  },
  CLIENT_SPEND: {
    label: {
      photographer: 'Client payment',
      client: 'Payment sent',
      'event-coordinator': 'Event payment',
      user: 'Payment sent',
      admin: 'Client spend',
    },
    tag: 'Payment',
    color: 'neutral',
  },
  AD_REVENUE: {
    label: {
      photographer: 'Ad revenue share',
      client: 'Ad revenue',
      'event-coordinator': 'Ad revenue',
      user: 'Ad revenue',
      admin: 'Ad revenue',
    },
    tag: 'Ad revenue',
    color: 'green',
  },
  PHOTO_PURCHASE: {
    label: {
      photographer: 'Photo sale',
      client: 'Photo purchase',
      'event-coordinator': 'Photo purchase',
      user: 'Photo purchase',
      admin: 'Photo purchase',
    },
    tag: 'Photo',
    color: 'blue',
  },
  PLATFORM_FEE: {
    label: {
      photographer: 'Platform fee',
      client: 'Platform fee',
      'event-coordinator': 'Platform fee',
      user: 'Platform fee',
      admin: 'Platform fee',
    },
    tag: 'Fee',
    color: 'neutral',
  },
  HELD: {
    label: {
      photographer: 'Held for delivery',
      client: 'Held in escrow',
      'event-coordinator': 'Held in escrow',
      user: 'Held in escrow',
      admin: 'Held',
    },
    tag: 'Held',
    color: 'amber',
  },
  PENDING: {
    label: {
      photographer: 'Pending clearance',
      client: 'Processing',
      'event-coordinator': 'Processing',
      user: 'Processing',
      admin: 'Pending',
    },
    tag: 'Pending',
    color: 'amber',
  },
  BLOCKED: {
    label: {
      photographer: 'Blocked',
      client: 'Blocked',
      'event-coordinator': 'Blocked',
      user: 'Blocked',
      admin: 'Blocked',
    },
    tag: 'Blocked',
    color: 'red',
  },
};

export function shouldHideMovement(m: Movement, role: DashboardRole): boolean {
  if (role === 'admin') return false;
  const cat = (m.category || '').toUpperCase();

  if (cat === 'PLATFORM_FEE') return true;
  if (cat === 'HELD' || cat === 'PENDING' || cat === 'BLOCKED') return true;
  if (role === 'photographer' && cat === 'CLIENT_SPEND') return true;

  if (
    (role === 'client' || role === 'event-coordinator' || role === 'user') &&
    cat === 'STREAM_FEES' &&
    m.direction === 'out'
  ) {
    return true;
  }

  return false;
}

export function formatWalletMovement(m: Movement, role: DashboardRole): MoneyItem | null {
  if (shouldHideMovement(m, role)) return null;

  const cat = (m.category || 'BALANCE').toUpperCase();
  const meta = CATEGORY_META[cat];
  const direction: MoneyItem['direction'] = m.direction === 'in' ? 'in' : 'out';

  let title: string;
  if (meta) {
    title = meta.label[role] || meta.label.admin || meta.label.client;
  } else {
    title = cat.replace(/_/g, ' ').toLowerCase();
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  // A debit on a photographer's booking balance is a deduction, not earnings.
  if (role === 'photographer' && cat === 'BALANCE' && direction === 'out') {
    title = 'Balance deduction';
  }
  // Rows appended by a data correction (e.g. V313) undo an earlier wrong entry.
  if (m.sourceType === 'DATA_CORRECTION') {
    title = 'Balance correction';
  }

  const subtitle = m.description || undefined;

  return {
    id: m.id,
    title: trMoney(title),
    subtitle,
    amount: Math.abs(m.amount),
    originalAmount: m.amount,
    originalCurrency: m.currency,
    direction,
    color: meta?.color ?? 'neutral',
    timestamp: m.createdAt || new Date().toISOString(),
    tag: meta?.tag ?? 'Other',
    sourceType: m.category,
  };
}

export interface StatCard {
  label: string;
  value: number;
  color: MoneyItem['color'];
  hidden: boolean;
}

export interface WalletStats {
  hero: { label: string; value: number };
  cards: StatCard[];
  pendingChip?: { label: string; value: number } | null;
  status: string;
}

export function selectWalletStats(w: WalletDTO, role: DashboardRole): WalletStats {
  const status = w.status || 'ACTIVE';

  if (role === 'photographer') {
    // The cards are the breakdown of balanceAvailable, so they add up to the hero.
    // A "Total earnings" card only repeated the hero (it is the withdrawable
    // balance, not lifetime earnings). In escrow and Total withdrawn are not part of it.
    const inEscrow = w.heldForDelivery || w.deliveryHeldAmount || 0;

    return {
      hero: { label: trMoney('Available to withdraw'), value: w.balanceAvailable },
      cards: [
        { label: trMoney('Booking earnings'), value: w.balanceBooking, color: 'green', hidden: w.balanceBooking === 0 },
        { label: trMoney('Tips'), value: w.balanceTips, color: 'purple', hidden: w.balanceTips === 0 },
        { label: trMoney('Bonuses'), value: w.balanceBonuses, color: 'amber', hidden: w.balanceBonuses === 0 },
        { label: trMoney('Stream bonus'), value: w.balanceStreamFees, color: 'blue', hidden: w.balanceStreamFees === 0 },
        { label: trMoney('Album sales'), value: w.balancePhotoPurchase, color: 'blue', hidden: w.balancePhotoPurchase === 0 },
        { label: trMoney('Gifts'), value: w.balanceGifts, color: 'purple', hidden: w.balanceGifts === 0 },
        { label: trMoney('Donations'), value: w.balanceDonations, color: 'purple', hidden: w.balanceDonations === 0 },
        { label: trMoney('Ad revenue'), value: w.balanceAdRevenue, color: 'blue', hidden: !w.balanceAdRevenue },
        { label: trMoney('In escrow'), value: inEscrow, color: 'amber', hidden: inEscrow === 0 },
        { label: trMoney('Total withdrawn'), value: w.totalWithdrawn, color: 'neutral', hidden: w.totalWithdrawn === 0 },
      ],
      pendingChip:
        w.pendingAmount + inEscrow > 0
          ? { label: trMoney('Pending clearance'), value: w.pendingAmount + inEscrow }
          : null,
      status,
    };
  }

  if (role === 'client') {
    return {
      hero: { label: trMoney('Total spent'), value: w.clientSpent },
      cards: [
        { label: trMoney('Available balance'), value: w.balanceAvailable, color: 'green', hidden: w.balanceAvailable === 0 },
        { label: trMoney('Refunds received'), value: w.totalRefunded, color: 'amber', hidden: w.totalRefunded === 0 },
        { label: trMoney('Tips sent'), value: w.balanceTips, color: 'purple', hidden: w.balanceTips === 0 },
        { label: trMoney('Gifts sent'), value: w.balanceGifts, color: 'purple', hidden: w.balanceGifts === 0 },
        { label: trMoney('Donations'), value: w.balanceDonations, color: 'purple', hidden: w.balanceDonations === 0 },
      ],
      pendingChip:
        w.pendingAmount > 0
          ? { label: trMoney('Processing'), value: w.pendingAmount }
          : null,
      status,
    };
  }

  if (role === 'event-coordinator') {
    return {
      hero: { label: trMoney('Available balance'), value: w.balanceAvailable },
      cards: [
        { label: trMoney('Stream revenue'), value: w.balanceStreamFees, color: 'blue', hidden: w.balanceStreamFees === 0 },
        { label: trMoney('Event spend'), value: w.clientSpent, color: 'neutral', hidden: w.clientSpent === 0 },
        { label: trMoney('Tips sent'), value: w.balanceTips, color: 'purple', hidden: w.balanceTips === 0 },
        { label: trMoney('Donations'), value: w.balanceDonations, color: 'purple', hidden: w.balanceDonations === 0 },
        { label: trMoney('Refunds received'), value: w.totalRefunded, color: 'amber', hidden: w.totalRefunded === 0 },
        { label: trMoney('Total withdrawn'), value: w.totalWithdrawn, color: 'neutral', hidden: w.totalWithdrawn === 0 },
      ],
      pendingChip:
        w.pendingAmount > 0
          ? { label: trMoney('Processing'), value: w.pendingAmount }
          : null,
      status,
    };
  }

  // user / fallback
  return {
    hero: { label: trMoney('Total spent'), value: w.clientSpent },
    cards: [
      { label: trMoney('Available balance'), value: w.balanceAvailable, color: 'green', hidden: w.balanceAvailable === 0 },
      { label: trMoney('Refunds received'), value: w.totalRefunded, color: 'amber', hidden: w.totalRefunded === 0 },
      { label: trMoney('Tips sent'), value: w.balanceTips, color: 'purple', hidden: w.balanceTips === 0 },
      { label: trMoney('Donations'), value: w.balanceDonations, color: 'purple', hidden: w.balanceDonations === 0 },
    ],
    pendingChip: w.pendingAmount > 0 ? { label: trMoney('Processing'), value: w.pendingAmount } : null,
    status,
  };
}

export type DirectionFilter = 'all' | 'in' | 'out' | 'withdrawals';

/**
 * The In/Out pills for the wallet lists. Photographers only receive money and take
 * it out by withdrawing, so "Money out" read to them as spending. They get Earnings
 * and Withdrawals instead; other roles keep Money in / Money out.
 */
export function getDirectionFilters(role: DashboardRole): { label: string; value: DirectionFilter }[] {
  if (role === 'photographer') {
    return [
      { label: trMoney('All'), value: 'all' },
      { label: trMoney('Earnings (+)'), value: 'in' },
      { label: trMoney('Withdrawals'), value: 'withdrawals' },
    ];
  }
  return [
    { label: trMoney('All'), value: 'all' },
    { label: trMoney('Money in (+)'), value: 'in' },
    { label: trMoney('Money out (−)'), value: 'out' },
  ];
}

export function matchesDirectionFilter(
  row: { direction: 'in' | 'out'; category?: string },
  filter: DirectionFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'withdrawals') return (row.category ?? '').toUpperCase() === 'WITHDRAWAL';
  return row.direction === filter;
}

/** True when the wallet page would show this movement to the role (internal ledger rows are not). */
export function isVisibleToRole(m: Movement, role: DashboardRole): boolean {
  return !shouldHideMovement(m, role);
}

export function getFilterTags(role: DashboardRole): string[] {
  if (role === 'photographer') {
    return ['All', 'Booking', 'Tip', 'Bonus', 'Stream', 'Photo', 'Donation', 'Withdrawal'];
  }
  if (role === 'client') {
    return ['All', 'Payment', 'Tip', 'Gift', 'Donation', 'Photo', 'Refund'];
  }
  if (role === 'event-coordinator') {
    return ['All', 'Payment', 'Stream', 'Tip', 'Donation', 'Refund', 'Withdrawal'];
  }
  return ['All', 'Payment', 'Booking', 'Tip', 'Donation', 'Refund'];
}

export const PALETTE: Record<
  MoneyItem['color'],
  { bar: string; tint: string; icon: string }
> = {
  green: { bar: '#10B981', tint: 'rgba(16,185,129,0.12)', icon: 'cash-outline' },
  amber: { bar: '#F59E0B', tint: 'rgba(245,158,11,0.14)', icon: 'time-outline' },
  blue: { bar: '#083A85', tint: 'rgba(8,58,133,0.10)', icon: 'videocam-outline' },
  red: { bar: '#DC2626', tint: 'rgba(220,38,38,0.12)', icon: 'arrow-up-circle-outline' },
  purple: { bar: '#F20C8F', tint: 'rgba(242,12,143,0.12)', icon: 'gift-outline' },
  neutral: { bar: '#797D86', tint: 'rgba(0,0,0,0.06)', icon: 'wallet-outline' },
};

export const COLOR_MAP: Record<
  MoneyItem['color'],
  { bg: string; text: string; border: string }
> = {
  green:   { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.25)' },
  red:     { bg: 'rgba(220, 38, 38, 0.12)',   text: '#DC2626', border: 'rgba(220, 38, 38, 0.25)' },
  blue:    { bg: 'rgba(8, 58, 133, 0.10)',    text: '#083A85', border: 'rgba(8, 58, 133, 0.22)' },
  amber:   { bg: 'rgba(245, 158, 11, 0.14)', text: '#D97706', border: 'rgba(245, 158, 11, 0.30)' },
  purple:  { bg: 'rgba(242, 12, 143, 0.12)', text: '#F20C8F', border: 'rgba(242, 12, 143, 0.25)' },
  neutral: { bg: 'rgba(0, 0, 0, 0.06)',       text: '#4B5563', border: 'rgba(0, 0, 0, 0.10)' },
};

export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  const lang = useLanguage.getState().language;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    if (lang === 'fr') return "à l'instant";
    if (lang === 'es') return 'justo ahora';
    if (lang === 'rw') return 'aka kanya';
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    if (lang === 'fr') return `il y a ${minutes}m`;
    if (lang === 'es') return `hace ${minutes}m`;
    if (lang === 'rw') return `hashize iminota ${minutes}`;
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (lang === 'fr') return `il y a ${hours}h`;
    if (lang === 'es') return `hace ${hours}h`;
    if (lang === 'rw') return `hashize amasaha ${hours}`;
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    if (lang === 'fr') return `il y a ${days}j`;
    if (lang === 'es') return `hace ${days}d`;
    if (lang === 'rw') return `hashize iminsi ${days}`;
    return `${days}d ago`;
  }

  const d = new Date(isoString);
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'rw' ? 'rw-RW' : 'en-US';
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
