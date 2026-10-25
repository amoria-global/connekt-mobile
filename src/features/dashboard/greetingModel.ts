import { darkPalette, lightPalette } from '@/theme/palettes';
/**
 * Greeting copy and the name gradient for the dashboard hero. The phrases and the
 * time-of-day windows are the web dashboards' (app/pages/*\/home.tsx), so a user sees
 * the same welcome on both. Pure functions so the rules are testable without a render.
 */

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const GREETINGS: Record<TimeOfDay, readonly string[]> = {
  morning: ['Good Morning', 'Rise and Shine', 'Beautiful Morning', 'Lovely Morning', 'Wonderful Morning', 'Great Morning', 'Happy Morning', 'Blessed Morning'],
  afternoon: ['Good Afternoon', 'Lovely Afternoon', 'Beautiful Afternoon', 'Wonderful Afternoon', 'Great Afternoon', 'Happy Afternoon', 'Blessed Afternoon', 'Amazing Afternoon'],
  evening: ['Good Evening', 'Lovely Evening', 'Beautiful Evening', 'Wonderful Evening', 'Great Evening', 'Happy Evening', 'Peaceful Evening', 'Relaxing Evening'],
  night: ['Good Night', 'Peaceful Night', 'Lovely Night', 'Beautiful Night', 'Wonderful Night', 'Quiet Night', 'Restful Night', 'Starry Night'],
};

/** Web: 5 to 12 morning, 12 to 17 afternoon, 17 to 21 evening, otherwise night. */
export function timeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** Web ends the gradient at the brand pink; the name starts navy on light and light blue on dark. */
export const NAME_GRADIENT = {
  light: { from: lightPalette.primary, to: lightPalette.accent },
  dark: { from: darkPalette.primaryLight, to: darkPalette.accentLight },
} as const;

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(from: string, to: string, t: number): string {
  const a = channels(from);
  const b = channels(to);
  const k = Math.min(1, Math.max(0, t));
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * One colour per character along the gradient. React Native cannot fill text with a
 * gradient without a native mask view, which this build does not ship, so the name is
 * drawn glyph by glyph.
 */
export function gradientChars(text: string, from: string, to: string): { ch: string; color: string }[] {
  const chars = Array.from(text);
  const last = Math.max(1, chars.length - 1);
  return chars.map((ch, i) => ({ ch, color: mixHex(from, to, i / last) }));
}
