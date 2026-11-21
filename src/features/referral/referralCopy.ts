/**
 * The milestone program wording, from the one shared source (src/content/referralCopy.json, copied verbatim from the
 * backend contract). Every language has every key; a missing key falls back to English.
 */
import raw from '@/content/referralCopy.json';

type Lang = 'en' | 'sw' | 'rw' | 'fr' | 'es';
type Bundle = Record<string, string>;
const DATA = raw as unknown as Record<Lang | '_readme', Bundle | string>;

export type MilestoneCopy = Bundle;

export function milestoneCopy(language: string): MilestoneCopy {
  const en = DATA.en as Bundle;
  const chosen = DATA[language as Lang];
  return typeof chosen === 'object' && chosen ? { ...en, ...chosen } : en;
}

/** Fills {placeholders}. An unknown placeholder becomes an empty string. */
export function fillCopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
