/**
 * The password rule shown on the collaborator's first-visit screen. It mirrors the platform rule (the server decides what
 * is accepted, including the known-breach check): at least 8 characters, with a letter, a number and one of @!#$%^&*=+.
 */
export const SETUP_PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@!#$%^&*=+]).{8,}$/;

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; tone: 'weak' | 'fair' | 'good' };

/** A rough 0 to 4 score for the hint under the field. Never a gate: the server is. */
export function passwordStrength(pw: string): PasswordStrength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[@!#$%^&*=+]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const s = score as 0 | 1 | 2 | 3 | 4;
  return { score: s, label: labels[s], tone: s >= 3 ? 'good' : s === 2 ? 'fair' : 'weak' };
}
