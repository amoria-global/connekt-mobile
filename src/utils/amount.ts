/**
 * Amount inputs: show thousands separators while typing, and read the number
 * back. Used by the booking sheet and the hybrid wizard.
 */

/** "1000000" -> "1,000,000"; anything but digits is dropped. */
export function formatAmountWithCommas(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

/** "1,000,000" -> 1000000; empty -> 0. */
export function parseAmountNumber(val: string): number {
  const digits = val.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
