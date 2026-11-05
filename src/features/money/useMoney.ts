/**
 * State behind MoneyInput: which currencies this device uses most (kept on the device, never sent anywhere), and the
 * exchange rates for the "about" line. Rates come from the existing public endpoint, one request per session.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { api } from '@/api/client';
import { storage, StorageKeys } from '@/services/storage';
import { EMPTY_USAGE, parseUsage, recordUse, type Rates, type Usage } from './moneyLogic';

type UsageState = { usage: Usage; loaded: boolean; load: () => Promise<void>; record: (code: string) => void };

export const useCurrencyUsage = create<UsageState>((set, get) => ({
  usage: EMPTY_USAGE,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const saved = await storage.get(StorageKeys.moneyCurrencyUsage).catch(() => null);
    set({ usage: parseUsage(saved), loaded: true });
  },
  record: (code) => {
    const next = recordUse(get().usage, code);
    set({ usage: next });
    storage.set(StorageKeys.moneyCurrencyUsage, JSON.stringify(next)).catch(() => {});
  },
}));

type RatesEnvelope = { data?: Record<string, { rateToUsd?: number | string }> };

let ratesPromise: Promise<Rates> | null = null;

function loadRates(): Promise<Rates> {
  ratesPromise ??= api
    .get<RatesEnvelope>('/public/currencies/rates', { skipAuth: true })
    .then((res) => {
      const out: Rates = {};
      for (const [code, v] of Object.entries(res?.data ?? {})) {
        const n = Number(v?.rateToUsd);
        if (n > 0) out[code.toUpperCase()] = { rateToUsd: n };
      }
      return out;
    })
    .catch(() => {
      ratesPromise = null; // try again next time a field mounts
      return {};
    });
  return ratesPromise;
}

/** The exchange rates (units per 1 USD), or an empty set while loading or when they cannot be read. */
export function useRates(): Rates {
  const [rates, setRates] = useState<Rates>({});
  useEffect(() => {
    let live = true;
    void loadRates().then((r) => live && setRates(r));
    return () => {
      live = false;
    };
  }, []);
  return rates;
}
