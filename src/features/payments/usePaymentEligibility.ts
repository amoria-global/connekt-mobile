/**
 * Detects the buyer's payment country and loads the methods the backend offers
 * for it. Shared by every payment sheet so none of them keeps its own default.
 *
 * - Detection is the backend's IP lookup. A failed or empty lookup leaves the
 *   country unknown (null). Nothing falls back to Rwanda.
 * - Choosing another country in the picker replaces the list and clears stale
 *   state; a late answer for an earlier country is ignored.
 * - `retry` repeats detection and the options lookup, so a lookup that failed
 *   once does not leave the buyer without mobile money for the whole session.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPaymentCountry, getPaymentOptions } from '@/features/reference/api';
import {
  normalizeCountry,
  resolveEligibility,
  type PaymentEligibility,
} from '@/features/payments/eligibility';

export function usePaymentEligibility(enabled = true) {
  const [eligibility, setEligibility] = useState<PaymentEligibility>(() =>
    resolveEligibility(null, null, true),
  );
  // Newest request wins; an older answer must not overwrite a newer choice.
  const generation = useRef(0);
  // A country the buyer chose stays chosen across retries; detection only runs until then.
  const chosen = useRef<string | undefined>(undefined);

  const run = useCallback(async (pick?: string) => {
    const mine = ++generation.current;
    const country = normalizeCountry(
      pick ?? (await detectPaymentCountry().catch(() => undefined)),
    );
    if (mine !== generation.current) return;
    if (!country) {
      setEligibility(resolveEligibility(null, null));
      return;
    }
    setEligibility(resolveEligibility(country, null, true));
    const options = await getPaymentOptions(country).catch(() => null);
    if (mine !== generation.current) return;
    setEligibility(resolveEligibility(country, options));
  }, []);

  // User-triggered reloads show the loading state first; the first load starts in it.
  const load = useCallback(
    (pick?: string) => {
      setEligibility(resolveEligibility(pick ?? null, null, true));
      return run(pick);
    },
    [run],
  );

  useEffect(() => {
    if (!enabled) return;
    const start = setTimeout(() => void run(), 0);
    return () => {
      clearTimeout(start);
      generation.current += 1;
    };
  }, [enabled, run]);

  const changeCountry = useCallback(
    (iso2: string) => {
      chosen.current = normalizeCountry(iso2) ?? undefined;
      return load(chosen.current);
    },
    [load],
  );
  const retry = useCallback(() => load(chosen.current), [load]);

  return { ...eligibility, changeCountry, retry };
}
