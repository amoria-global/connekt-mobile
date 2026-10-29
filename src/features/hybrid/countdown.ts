/**
 * Time left until a deadline, for the incoming offer call (IncomingOpportunityAlertModal). The label reads
 * Days:Hours:Minutes:Seconds, every part two digits, for example "00:01:59:30" for one hour, fifty-nine minutes and thirty
 * seconds. A missing or unreadable deadline gives null, so the call simply shows no expiry badge.
 */
export type TimeLeft = {
  /** True once the deadline has passed (or is right now). */
  done: boolean;
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** "DD:HH:MM:SS". */
  label: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

export function timeLeft(deadline: string | number | Date | null | undefined, nowMs: number): TimeLeft | null {
  if (deadline === null || deadline === undefined || deadline === '') return null;
  const target = deadline instanceof Date ? deadline.getTime() : typeof deadline === 'number' ? deadline : Date.parse(deadline);
  if (!Number.isFinite(target) || !Number.isFinite(nowMs)) return null;
  const ms = Math.max(0, target - nowMs);
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { done: ms <= 0, ms, days, hours, minutes, seconds, label: `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
}
