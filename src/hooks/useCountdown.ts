import { useEffect, useState } from 'react';

/**
 * Whole seconds left until `endsAtMs`, ticking once a second. `null` means no timer.
 * Callers build `endsAtMs` from the server's timestamps (see `secondsUntil` in
 * features/auth/twoFactor), so the device clock cannot stretch or cut a lock or a resend wait.
 */
export function useCountdown(endsAtMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAtMs == null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAtMs) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [endsAtMs]);

  // Computed from the target on every render, so a new target shows at once without a tick.
  if (endsAtMs == null) return 0;
  // eslint-disable-next-line react-hooks/purity -- reading the clock is the point of a countdown
  return Math.max(0, Math.ceil((endsAtMs - Math.max(now, Date.now())) / 1000));
}
