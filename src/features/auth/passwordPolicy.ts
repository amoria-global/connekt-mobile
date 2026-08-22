/**
 * Client-side mirror of the backend's PasswordPolicyService.
 *
 * Keep these rules in sync with
 * `backend-connekyt/src/main/java/com/amoria/amoriaconnect/services/PasswordPolicyService.java`.
 * The backend is still the authority (it also runs a Have I Been Pwned breach
 * check we can't do offline) — this exists so the user gets an instant, local
 * reason instead of a round-trip rejection after submitting.
 */

/** Must match SPECIAL_CHARS in PasswordPolicyService. */
export const PASSWORD_SPECIAL_CHARS = '@!#$%^&*=+';

export const PASSWORD_MIN_LENGTH = 8;

/** Human-readable requirement list, shown as a hint under password inputs. */
export const PASSWORD_HINT =
  `At least ${PASSWORD_MIN_LENGTH} characters, including a letter, a number, ` +
  `and a special character (${PASSWORD_SPECIAL_CHARS}).`;

/**
 * Returns the first unmet requirement, or null when the password satisfies
 * every rule we can check locally. Mirrors the backend's fail-fast ordering so
 * the two surfaces report the same reason first.
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit.';
  }
  if (![...PASSWORD_SPECIAL_CHARS].some((c) => password.includes(c))) {
    return `Password must contain at least one special character (${PASSWORD_SPECIAL_CHARS}).`;
  }
  return null;
}
