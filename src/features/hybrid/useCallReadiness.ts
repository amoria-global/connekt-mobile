/**
 * Ensures any legacy background foreground service (KeepAliveService) is stopped
 * so Android 14+ never terminates the process with ForegroundServiceDidNotStartInTimeException
 * or interrupts the user on app launch.
 */
import { useEffect } from 'react';
import { isIncomingCallAvailable, setKeepReady } from './incomingCall';

export function useCallReadiness(_enabled: boolean): void {
  useEffect(() => {
    if (!isIncomingCallAvailable()) return;
    setKeepReady(false);
  }, []);
}
