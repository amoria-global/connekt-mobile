import { compactFont, compactRadius, compactSpace, compactStyle, density, hitSlopFor } from './density';

describe('Compact Glass density', () => {
  it('maps the old sizes onto the reference scale', () => {
    expect(compactFont(32)).toBe(22);
    expect(compactFont(20)).toBeLessThanOrEqual(16);
    expect(compactFont(16)).toBe(14);
    expect(compactFont(15)).toBeLessThanOrEqual(14);
    expect(compactFont(40)).toBeLessThanOrEqual(28);
    expect(compactFont(12)).toBe(12);
  });

  it('never grows anything and is monotonic', () => {
    let prevF = 0;
    let prevS = 0;
    for (let v = 8; v <= 48; v++) {
      expect(compactFont(v)).toBeLessThanOrEqual(v);
      expect(compactFont(v)).toBeGreaterThanOrEqual(prevF);
      prevF = compactFont(v);
      expect(compactSpace(v)).toBeLessThanOrEqual(v);
      expect(compactSpace(v)).toBeGreaterThanOrEqual(prevS);
      prevS = compactSpace(v);
    }
  });

  it('shrinks card padding, gaps and radii to the reference', () => {
    expect(compactSpace(22)).toBeLessThanOrEqual(16);
    expect(compactSpace(14)).toBeLessThanOrEqual(12);
    expect(compactSpace(32)).toBeLessThanOrEqual(20);
    expect(compactRadius(28)).toBe(density.radius.card);
    expect(compactRadius(14)).toBe(density.radius.button);
  });

  it('keeps circles, pills and fixed sizes, and scales line height with the font', () => {
    expect(compactStyle({ width: 56, height: 56, borderRadius: 28 }).borderRadius).toBe(28);
    expect(compactStyle({ borderRadius: 999 }).borderRadius).toBe(999);
    expect(compactStyle({ width: 120 }).width).toBe(120);
    const t = compactStyle({ fontSize: 32, lineHeight: 40 });
    expect(t.fontSize).toBe(22);
    expect(t.lineHeight).toBe(28);
  });

  it('tops a small visual up to a 44pt target', () => {
    expect(hitSlopFor(32)).toEqual({ left: 6, right: 6, top: 6, bottom: 6 });
    expect(hitSlopFor(48)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });
});
