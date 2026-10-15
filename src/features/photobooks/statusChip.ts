/**
 * Status chip colours for photobooks. Light keeps the existing pastel fills. Dark swaps in the deep tinted grounds with
 * light text that the status tokens use everywhere else, because the pastel pills (cream, light blue) glared on navy.
 * Keyed by the light background so the existing STATUS_META tables stay as they are.
 */
import type { Palette } from '@/theme/palettes';

type Chip = { bg: string; fg: string };

const KIND: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
  '#D1FAE5': 'success',
  '#FEF3C7': 'warning',
  '#DBEAFE': 'info',
  '#FEE2E2': 'error',
  '#E5E7EB': 'neutral',
};

export function chipColors(chip: Chip, isDark: boolean, c: Palette): Chip {
  if (!isDark) return chip;
  const kind = KIND[chip.bg.toUpperCase()];
  if (!kind) return chip; // an unknown status keeps its own scrim and white text
  if (kind === 'neutral') return { bg: c.surfaceMuted, fg: c.textSoft };
  return { bg: c[`${kind}Bg` as const], fg: c[kind] };
}
