/**
 * Backend movement descriptions embed internal codes ("held until MS1_PHOTOBOOK_HOLD is released").
 * This turns each CODE_LIKE_TOKEN into plain words for display. It never invents meaning: a known code gets its
 * label, any other code has its milestone prefix (MS1_, V2_) stripped, underscores replaced and is lower-cased,
 * and text without codes is returned untouched. A title that ends up empty reads "Transaction".
 */
const KNOWN: Record<string, string> = {
  MS1_UPFRONT: 'upfront payment',
};

const CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+_*/g;
/** A leading release or milestone tag such as MS1, MS12 or V2. */
const PREFIX = /^[A-Z]{1,3}\d+$/;

export const FALLBACK_TITLE = 'Transaction';

function wordsFromCode(code: string): string {
  const known = KNOWN[code];
  if (known) return known;
  const parts = code.split('_').filter(Boolean);
  while (parts.length > 0 && PREFIX.test(parts[0])) parts.shift();
  return parts.join(' ').toLowerCase();
}

export function humanizeCodes(text: string): string {
  return text.replace(CODE, wordsFromCode).replace(/\s{2,}/g, ' ').trim();
}

/** Display title: codes in words, first letter capitalised when a code was rewritten, never empty. */
export function movementTitle(clean: string): string {
  const out = humanizeCodes(clean);
  if (!/[A-Za-z0-9]/.test(out)) return FALLBACK_TITLE;
  return out === clean.trim() ? out : out.charAt(0).toUpperCase() + out.slice(1);
}
