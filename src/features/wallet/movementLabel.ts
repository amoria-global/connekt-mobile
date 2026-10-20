/**
 * Backend movement descriptions embed internal codes ("held until MS1_PHOTOBOOK_HOLD is released").
 * This turns each CODE_LIKE_TOKEN into plain words for display. It never invents meaning: a known code gets its
 * label, any other code is just lower-cased and de-underscored, and text without codes is returned untouched.
 */
const KNOWN: Record<string, string> = {
  MS1_UPFRONT: 'upfront payment',
};

const CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

export function humanizeCodes(text: string): string {
  return text.replace(CODE, (code) => {
    const known = KNOWN[code];
    if (known) return known;
    return code
      .replace(/^MS\d+_/, '')
      .toLowerCase()
      .replace(/_/g, ' ');
  });
}

/** Sentence-case the first letter only when the description started with a code. */
export function movementTitle(clean: string): string {
  const out = humanizeCodes(clean);
  return out === clean ? clean : out.charAt(0).toUpperCase() + out.slice(1);
}
