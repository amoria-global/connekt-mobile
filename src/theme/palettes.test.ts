import { darkPalette, gradientsFor, lightPalette } from './palettes';

/**
 * Dark-mode review of the photographer screens (against the prototype) found small text that fell under AA on the
 * card surface, and a step structure that was too flat to read as layered. These pin both.
 */
const lum = (hex: string) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
])('%s palette text contrast (WCAG AA, 4.5:1)', (_name, p) => {
  it.each(['background', 'surface', 'card', 'elevated'] as const)('body, soft, muted and link text read on %s', (ground) => {
    expect(ratio(p.text, p[ground])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.textSoft, p[ground])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.textMuted, p[ground])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.link, p[ground])).toBeGreaterThanOrEqual(4.5);
  });

  it('wallet chip text reads on the stronger tinted grounds', () => {
    expect(ratio(p.warning, p.warningSoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.warning, p.errorSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['success', 'warning', 'error', 'info'] as const)('%s status text reads on its tinted ground and on a card', (k) => {
    expect(ratio(p[k], p[`${k}Bg` as const])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p[k], p.card)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the primary fill passes', () => {
    expect(ratio(p.textOnPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('dark palette layering', () => {
  it('uses the prototype navy ground, not the old neutral graphite', () => {
    // Hue check: blue channel leads red and green by a clear margin (the old #0E1117 led by only 9).
    const n = darkPalette.background.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
    expect(b - r).toBeGreaterThanOrEqual(20);
    expect(b).toBeGreaterThan(g);
  });

  it('steps up from page to surface to card to elevated, so cards separate without shadows', () => {
    const steps = [darkPalette.background, darkPalette.surface, darkPalette.card, darkPalette.elevated].map(lum);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(4);
  });

  it('has a hairline border visible on a card', () => {
    expect(ratio(darkPalette.border, darkPalette.card)).toBeGreaterThan(1.3);
  });

  it('exposes the same keys as light', () => {
    expect(Object.keys(darkPalette).sort()).toEqual(Object.keys(lightPalette).sort());
  });
});

describe.each(['light', 'dark'] as const)('%s hero gradients', (scheme) => {
  it.each(['heroBlue', 'heroViolet'] as const)('white text reads on every stop of %s', (name) => {
    for (const stop of gradientsFor(scheme)[name]) expect(ratio('#FFFFFF', stop)).toBeGreaterThanOrEqual(4.5);
  });
});
