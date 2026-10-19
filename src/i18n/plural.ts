import type { TranslationKey } from './translations';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * Plural-aware translate: picks `${base}_one` or `${base}_other` and passes
 * `{count}`. English, French and Spanish all have just these two forms.
 * (French treats 0 as singular; with counts of photos that is never shown.)
 *
 *   tp(t, 'fmp_photosN', 3)  // "3 photos"
 */
export function tp(t: Translate, base: string, count: number, params?: Record<string, string | number>): string {
  const key = `${base}_${count === 1 ? 'one' : 'other'}` as TranslationKey;
  return t(key, { count, ...params });
}
