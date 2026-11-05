/**
 * What a person reads when something goes wrong. One entry per backend `errorCode`, plus the generic cases by
 * transport (offline, timeout, server down, signed out). Plain words: what happened, then what to do. No codes, no
 * statuses, no blame. Copy is English first; every string is a template so a translation can swap the whole map.
 *
 * Templates take `{attemptsLeft}` and `{wait}` (a ready-made "3 minutes" text). A missing parameter drops its sentence
 * instead of printing "{wait}".
 */

export type Severity = 'field' | 'toast' | 'banner' | 'sheet' | 'fullscreen' | 'signin';
export type Tone = 'danger' | 'warning' | 'info';
export type ActionId = 'retry' | 'back' | 'home' | 'change-method' | 'contact-support' | 'sign-in' | 'resend' | 'dismiss';

export type CatalogueEntry = {
  title: string;
  message: string;
  /** Where it shows when the caller does not say otherwise. */
  severity: Severity;
  tone?: Tone;
  actions?: ActionId[];
  /** The form field the problem belongs to, when the backend does not name one. */
  field?: string;
};

export const ACTION_LABELS: Record<ActionId, string> = {
  retry: 'Try again',
  back: 'Go back',
  home: 'Go to Home',
  'change-method': 'Change method',
  'contact-support': 'Contact support',
  'sign-in': 'Sign in',
  resend: 'Send a new code',
  dismiss: 'Close',
};

/** Backend `errorCode` to copy. Keep alphabetical inside each group. */
export const CATALOGUE: Record<string, CatalogueEntry> = {
  // One-time codes and two-factor
  CODE_ALREADY_USED: {
    title: 'That code was already used',
    message: 'Wait for the next code in your app, then enter it.',
    severity: 'field',
    field: 'code',
  },
  EXPIRED: {
    title: 'That code has expired',
    message: 'Ask for a new one and enter it within 5 minutes.',
    severity: 'field',
    field: 'code',
    actions: ['resend'],
  },
  LOCKED: {
    title: 'Too many tries',
    message: 'For your security, start again in {wait}.',
    severity: 'sheet',
    tone: 'warning',
    actions: ['dismiss'],
  },
  NOT_CONFIGURED: {
    title: 'Two-factor is not set up yet',
    message: 'Turn it on in Security settings, then try again.',
    severity: 'sheet',
    tone: 'info',
    actions: ['back'],
  },
  RATE_LIMITED: {
    title: 'Please wait a moment',
    message: 'You asked for a few codes in a row. Try again in {wait}.',
    severity: 'toast',
    tone: 'warning',
  },
  RESEND_TOO_SOON: {
    title: 'A code is already on its way',
    message: 'You can ask for another in {wait}.',
    severity: 'toast',
    tone: 'info',
  },
  SESSION_EXPIRED: {
    title: 'Your sign-in session ended',
    message: 'Sign in again to continue. Nothing you typed is lost.',
    severity: 'signin',
    actions: ['sign-in'],
  },
  WRONG_CODE: {
    title: "That code didn't work",
    message: "Check it and try again. {attemptsLeft} left.",
    severity: 'field',
    field: 'code',
  },

  // Sign-in, sign-up and passwords
  CHALLENGE_REQUIRED: {
    title: 'One more step to sign in',
    message: 'Enter the code from your authenticator or email to continue.',
    severity: 'field',
    tone: 'info',
    field: 'code',
  },
  EXISTING_ACCOUNT: {
    title: 'You already have an account',
    message: 'Sign in with that email, or reset your password if you forgot it.',
    severity: 'field',
    field: 'email',
    actions: ['sign-in'],
  },
  LINK_INVALID: {
    title: 'That link no longer works',
    message: 'It may have expired or already been used. Ask for a new one.',
    severity: 'sheet',
    actions: ['back'],
  },
  MISSING_FIELDS: {
    title: 'Some details are missing',
    message: 'Fill in the highlighted fields and try again.',
    severity: 'field',
  },
  PASSWORD_MISMATCH: {
    title: "The passwords don't match",
    message: 'Type the same password in both fields.',
    severity: 'field',
    field: 'confirmPassword',
  },
  WEAK_PASSWORD: {
    title: 'Choose a stronger password',
    message: 'Use at least 8 characters with a mix of letters and numbers.',
    severity: 'field',
    field: 'password',
  },
  WORKSPACE_ACCESS_ENDED: {
    title: 'Your access to this workspace ended',
    message: 'Ask the owner to invite you again. Your own account is unchanged.',
    severity: 'sheet',
    tone: 'info',
    actions: ['home'],
  },
};

/** Cases that have no backend code: how the request failed, not what the server said. */
export const TRANSPORT: Record<
  'offline' | 'timeout' | 'server' | 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'tooMany' | 'unknown',
  CatalogueEntry
> = {
  offline: {
    title: "You're offline",
    message: "Check your connection and try again. What you typed is kept.",
    severity: 'toast',
    tone: 'warning',
    actions: ['retry'],
  },
  timeout: {
    title: 'That took too long',
    message: 'Check your connection and try again.',
    severity: 'toast',
    tone: 'warning',
    actions: ['retry'],
  },
  server: {
    title: "We can't reach Connekyt right now",
    message: 'This is on our side, not yours. Your work is saved on this device.',
    severity: 'toast',
    tone: 'danger',
    actions: ['retry'],
  },
  unauthorized: {
    title: 'Your sign-in session ended',
    message: 'Sign in again to continue. Nothing you typed is lost.',
    severity: 'signin',
    actions: ['sign-in'],
  },
  forbidden: {
    title: "You don't have access to this",
    message: 'If you think that is a mistake, contact support.',
    severity: 'sheet',
    tone: 'info',
    actions: ['back', 'contact-support'],
  },
  notFound: {
    title: "We couldn't find that",
    message: 'It may have been removed. Go back and try again.',
    severity: 'sheet',
    tone: 'info',
    actions: ['back'],
  },
  conflict: {
    title: 'That changed while you were editing',
    message: 'Reload to see the latest version, then try again.',
    severity: 'sheet',
    tone: 'warning',
    actions: ['retry'],
  },
  tooMany: {
    title: 'Please slow down a little',
    message: 'Too many tries in a short time. Try again in {wait}.',
    severity: 'toast',
    tone: 'warning',
  },
  unknown: {
    title: 'Something went wrong',
    message: "We couldn't finish that. Try again, and contact support if it keeps happening.",
    severity: 'toast',
    tone: 'danger',
    actions: ['retry', 'contact-support'],
  },
};
