import { midnightStyles } from './makeStyles';
import { darkPalette, lightPalette } from './palettes';
import { shadows } from './shadows';

/** The Midnight Glass pass every themed stylesheet goes through (CLAUDE.md, Design System). */
describe('midnightStyles', () => {
  const run = (st: Record<string, unknown>, c = darkPalette, dark = true) => midnightStyles({ x: st }, c, dark).x as Record<string, unknown>;

  it('gives a weight-only text style the family for its weight, and drops the weight', () => {
    expect(run({ fontSize: 15 })).toMatchObject({ fontFamily: 'Inter_400Regular' });
    expect(run({ fontWeight: '600' })).toEqual({ fontFamily: 'Inter_600SemiBold' });
    expect(run({ fontSize: 20, fontWeight: '800' })).toEqual({ fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' });
  });

  it('leaves a chosen family alone, but maps the retired Pragati Narrow', () => {
    expect(run({ fontFamily: 'Inter_500Medium', fontWeight: '700' })).toEqual({ fontFamily: 'Inter_500Medium', fontWeight: '700' });
    expect(run({ fontFamily: 'PragatiNarrow_700Bold' }).fontFamily).toBe('SpaceGrotesk_700Bold');
  });

  it('turns a rounded card into glass with the stroke edge and the glass shadow', () => {
    expect(run({ backgroundColor: darkPalette.card, borderRadius: 16, borderWidth: 1, borderColor: darkPalette.border })).toEqual({
      backgroundColor: darkPalette.glassTop,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: darkPalette.stroke,
      boxShadow: shadows.glass,
    });
    expect(run({ backgroundColor: lightPalette.surface, borderRadius: 20 }, lightPalette, false).boxShadow).toBe(shadows.glassLight);
  });

  it('leaves bars, rows, deliberate colours and existing shadows alone', () => {
    expect(run({ backgroundColor: darkPalette.card })).toEqual({ backgroundColor: darkPalette.card });
    expect(run({ backgroundColor: darkPalette.card, borderRadius: 8 })).toEqual({ backgroundColor: darkPalette.card, borderRadius: 8 });
    expect(run({ backgroundColor: darkPalette.primary, borderRadius: 20 })).toEqual({ backgroundColor: darkPalette.primary, borderRadius: 20 });
    expect(run({ backgroundColor: darkPalette.card, borderRadius: 20, shadowColor: '#000' }).backgroundColor).toBe(darkPalette.card);
    expect(run({ backgroundColor: darkPalette.card, borderRadius: 20, borderColor: darkPalette.accent }).borderColor).toBe(darkPalette.accent);
  });
});
