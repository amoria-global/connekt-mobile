/**
 * Status chip colours for photobooks and albums, from the palette: a status names its tone
 * (success, pending, info, error, neutral) and `swatch` gives the pair for the active scheme.
 * A status with no tone (an unknown one) keeps its own colours.
 */
import { swatch, type Palette, type SwatchTone } from '@/theme';

type Chip = { bg: string; fg: string };

export function chipColors(chip: { tone?: SwatchTone; bg?: string; fg?: string }, _isDark: boolean, c: Palette): Chip {
  if (chip.tone) return swatch(c, chip.tone);
  return { bg: chip.bg ?? c.surfaceMuted, fg: chip.fg ?? c.text };
}
