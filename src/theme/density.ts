/**
 * Compact Glass density (design/compact-glass.png): the same glass, glow and raised accents at the
 * old, tighter density. One pass, applied to every themed stylesheet by `makeStyles`
 * (`compactStyle`), so a screen does not hand-tune its sizes:
 *
 *   token                 was        now
 *   screen title          32         22 / 700
 *   card title            20         14.5 to 16 / 700
 *   body                  16         14 / 400
 *   caption, subtitle     15         11.5 to 12
 *   big number            40         22 to 28
 *   card padding          22         10 to 12
 *   gap between cards     14         8
 *   section spacing       32         16 to 20
 *   radius card / button  28         16 / 12
 *   action tile height    ~125       48 to 56
 *   list row height       ~72        48 to 52
 *
 * Icons are sized where they are drawn: `density.icon` (16 to 18) and `density.iconTile` (32 to 36).
 * Hit areas stay 44pt: a smaller visual gets `hitSlop` (`hitSlopFor`), never a smaller target.
 */
import type { Insets } from 'react-native';

export const density = {
  fontSize: { title: 22, cardTitle: 15, body: 14, caption: 12, number: 24 },
  icon: 17,
  iconTile: 34,
  cardPadding: 12,
  gap: 8,
  section: 18,
  radius: { card: 16, button: 12 },
  tileHeight: { min: 48, max: 56 },
  rowHeight: { min: 48, max: 52 },
  button: { primary: 44, secondary: 40, tertiary: 36, chip: 32 },
  hit: 44,
} as const;

/** Old design size to compact size. Values at or below 14 are already compact. */
export function compactFont(f: number): number {
  if (f <= 14) return f;
  if (f <= 16) return 14;
  if (f <= 18) return 15;
  if (f <= 20) return 15.5;
  if (f <= 23) return 18;
  if (f <= 27) return 22;
  if (f <= 33) return 22;
  return 24;
}

/** Padding, margin and gap. Up to 10 is already tight. */
export function compactSpace(v: number): number {
  const a = Math.abs(v);
  if (a <= 10) return v;
  const s = v < 0 ? -1 : 1;
  const n = a <= 13 ? 10 : a <= 16 ? 12 : a <= 20 ? 14 : a <= 24 ? 16 : a <= 32 ? 20 : Math.round(a * 0.6);
  return s * n;
}

/** Corners. Circles and pills are left alone by the caller. */
export function compactRadius(r: number): number {
  if (r <= 10) return r;
  if (r <= 14) return 12;
  if (r <= 19) return 14;
  if (r <= 28) return 16;
  return r;
}

/** Row and tile minimum heights: tall rows shrink, anything near a 44pt target stays. */
export function compactMinHeight(h: number): number {
  if (h >= 100) return Math.round(h * 0.5);
  if (h >= 72) return 52;
  if (h >= 60) return 52;
  return h;
}

const SPACE_KEYS = [
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'gap', 'rowGap', 'columnGap',
] as const;

/** Applies the density to one style object (a copy). */
export function compactStyle(raw: Record<string, unknown>): Record<string, unknown> {
  const st = { ...raw };
  const fs = typeof st.fontSize === 'number' ? st.fontSize : undefined;
  if (fs !== undefined) {
    const next = compactFont(fs);
    st.fontSize = next;
    if (typeof st.lineHeight === 'number') st.lineHeight = Math.round((st.lineHeight * next) / fs);
  }
  for (const k of SPACE_KEYS) if (typeof st[k] === 'number') st[k] = compactSpace(st[k] as number);
  if (typeof st.minHeight === 'number') st.minHeight = compactMinHeight(st.minHeight);
  const r = st.borderRadius;
  if (typeof r === 'number' && r > 10 && r < 30) {
    const w = st.width;
    const h = st.height;
    const circle = (typeof w === 'number' && w === r * 2) || (typeof h === 'number' && h === r * 2);
    if (!circle) st.borderRadius = compactRadius(r);
  }
  return st;
}

/** `hitSlop` that tops a visual up to the 44pt target. */
export function hitSlopFor(width: number, height = width): Insets {
  return { left: Math.max(0, (44 - width) / 2), right: Math.max(0, (44 - width) / 2), top: Math.max(0, (44 - height) / 2), bottom: Math.max(0, (44 - height) / 2) };
}

/** `compactStyle` over a whole stylesheet object. */
export function compactStyles(styles: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(styles)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? compactStyle(v as Record<string, unknown>) : v;
  return out;
}
