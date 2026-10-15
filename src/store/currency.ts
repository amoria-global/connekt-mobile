/**
 * Display currency selection, mirroring the web dashboard's CurrencyContext
 * (salo-run app/context/CurrencyContext.tsx): the same six currencies, the same
 * fallback rates, live rates from /public/currencies/rates, and the choice
 * persisted on the device. Every rate is "units of that currency per 1 USD".
 */
import { create } from 'zustand';
import { api } from '@/api/client';
import { useAuth } from '@/store/auth';
import { storage, StorageKeys } from '@/services/storage';

export type CurrencyCode = 'USD' | 'RWF' | 'EUR' | 'KES' | 'UGX' | 'TZS';

export type CurrencyInfo = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** ISO 3166 country code, lower case, for the flag. */
  flag: string;
  rate: number;
  decimals: number;
};

/**
 * Names and precision only. A rate of 0 means "the backend has not supplied
 * one": there is no built-in rate for any currency but USD, because an invented
 * rate shown as current misstates money. Amounts in such a currency are shown in
 * the currency they are denominated in (convertAndFormat returns null).
 */
export const DEFAULT_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: 'us', rate: 1, decimals: 2 },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF', flag: 'rw', rate: 0, decimals: 0 },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: 'eu', rate: 0, decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: 'ke', rate: 0, decimals: 0 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', flag: 'ug', rate: 0, decimals: 0 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', flag: 'tz', rate: 0, decimals: 0 },
];

/**
 * Convert `amount` denominated in `from` (omitted or "USD" means USD, as on
 * web) into `to`, and format it. Returns null when `from` is a currency we hold
 * no rate for, so the caller can show the amount untouched instead of
 * mislabelling it.
 */
export function convertAndFormat(
  amount: number,
  from: string | undefined,
  to: CurrencyCode,
  currencies: CurrencyInfo[],
): string | null {
  const target = currencies.find((c) => c.code === to);
  if (!target || !(target.rate > 0)) return null; // no live rate: let the caller show the amount as it is
  let usd = amount;
  if (from && from !== 'USD') {
    const src = currencies.find((c) => c.code === from);
    if (!src || !(src.rate > 0)) return null;
    usd = amount / src.rate;
  }
  const formatted = (usd * target.rate).toLocaleString('en-US', {
    minimumFractionDigits: target.decimals,
    maximumFractionDigits: target.decimals,
  });
  if (target.code === 'USD') return `$${formatted}`;
  if (target.code === 'EUR') return `€${formatted}`;
  return `${target.symbol} ${formatted}`;
}

type CurrencyState = {
  currency: CurrencyCode;
  currencies: CurrencyInfo[];
  setCurrency: (code: CurrencyCode) => void;
  /** Read the saved choice and fetch live rates. Safe to call more than once. */
  load: () => Promise<void>;
  /**
   * Reconcile with the account's saved currency (shared with the web dashboard).
   * The account's value wins; if it has none yet, this device's choice is saved to it.
   */
  syncWithAccount: () => Promise<void>;
};

const ACCOUNT_PATH = '/customer/profile/display-currency';
type AccountEnvelope = { action?: number; data?: { currency?: string | null } };

function isSupported(code: unknown): code is CurrencyCode {
  return typeof code === 'string' && DEFAULT_CURRENCIES.some((c) => c.code === code);
}

async function saveToAccount(code: CurrencyCode) {
  if (useAuth.getState().status !== 'authenticated') return;
  try {
    await api.put<AccountEnvelope>(ACCOUNT_PATH, { currency: code });
  } catch {
    // Offline or not yet deployed: the device keeps the choice and the next sync retries.
  }
}

type RatesEnvelope = {
  data?: Record<string, { rateToUsd?: number | string; symbol?: string; name?: string }>;
};

export const useCurrency = create<CurrencyState>((set, get) => ({
  currency: 'USD',
  currencies: DEFAULT_CURRENCIES,

  setCurrency: (code) => {
    set({ currency: code });
    storage.set(StorageKeys.displayCurrency, code).catch(() => {});
    saveToAccount(code);
  },

  syncWithAccount: async () => {
    try {
      const res = await api.get<AccountEnvelope>(ACCOUNT_PATH);
      if (res?.action === 0) return;
      const remote = res?.data?.currency;
      if (isSupported(remote)) {
        if (remote !== get().currency) {
          set({ currency: remote });
          storage.set(StorageKeys.displayCurrency, remote).catch(() => {});
        }
      } else {
        await saveToAccount(get().currency);
      }
    } catch {
      // Keep the device's choice; the next sign-in retries.
    }
  },

  load: async () => {
    const saved = await storage.get(StorageKeys.displayCurrency).catch(() => null);
    if (isSupported(saved)) {
      set({ currency: saved });
    }
    try {
      const res = await api.get<RatesEnvelope>('/public/currencies/rates', { skipAuth: true });
      const rates = res?.data;
      if (!rates || typeof rates !== 'object') return;
      set({
        currencies: get().currencies.map((c) => {
          const live = rates[c.code];
          const rate = live?.rateToUsd != null ? parseFloat(String(live.rateToUsd)) : NaN;
          if (!live || !Number.isFinite(rate) || rate <= 0) return c;
          return { ...c, rate, symbol: live.symbol || c.symbol, name: live.name || c.name };
        }),
      });
    } catch {
      // Keep the fallback rates when the API is unavailable.
    }
  },
}));
