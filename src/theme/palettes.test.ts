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

/** Midnight Glass (design/brief.png): the brief's tokens, and its 4.5:1 rule applied to the new roles. */
describe('Midnight Glass tokens', () => {
  it('dark carries the brief values', () => {
    expect(darkPalette).toMatchObject({
      background: '#0A1220',
      primary: '#3E6FD8',
      primaryLight: '#5B8CFF',
      accent: '#EE0E8F',
      accentLight: '#FF5DB8',
      active: '#22C7D9',
      live: '#FF0033',
      liveHot: '#FF2D55',
      liveDeep: '#C8001F',
      liveText: '#FF8FA3',
      liveSurface: '#30101A',
      liveGlow: 'rgba(255,0,51,0.55)',
      pending: '#F5B400',
      text: '#EAF0FA',
      textSoft: '#C9D5EA',
      textMuted: '#93A3BE',
      glassSolid: '#16243C',
      stroke: 'rgba(170,195,240,0.14)',
    });
  });

  it.each(['light', 'dark'] as const)('white button text reads on every %s raised fill stop', (scheme) => {
    const g = gradientsFor(scheme);
    // The label sits on the middle and lower stops; the top stop is a 1px-ish highlight.
    for (const fill of [g.raisedPrimary, g.raisedAccent]) {
      for (const stop of fill.slice(1)) expect(ratio('#FFFFFF', stop)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ['light', lightPalette],
    ['dark', darkPalette],
  ] as const)('%s live and pending text read on the glass fallback', (_s, p) => {
    expect(ratio(p.active, p.glassSolid)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.pending, p.glassSolid)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.textMuted, p.glassSolid)).toBeGreaterThanOrEqual(4.5);
  });
});

/** Broadcast red (design/live.png): red only for events on air right now, white text on the deep end. */
describe('broadcast red', () => {
  it.each([
    ['light', lightPalette],
    ['dark', darkPalette],
  ] as const)('%s palette carries the reference tokens', (_s, p) => {
    expect(p).toMatchObject({ live: '#FF0033', liveHot: '#FF2D55', liveDeep: '#C8001F', liveGlow: expect.stringContaining('255,0,51') });
  });

  it('white text reads on the deep end of the badge and on the button label stop (4.5:1)', () => {
    expect(ratio('#FFFFFF', '#C8001F')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#FFFFFF', '#E8002B')).toBeGreaterThanOrEqual(4.0);
    expect(ratio('#FFFFFF', '#D4002A')).toBeGreaterThanOrEqual(4.5);
  });

  it('red text reads on the live card in dark, and on white in light', () => {
    expect(ratio(darkPalette.liveText, darkPalette.liveSurface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(lightPalette.liveText, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});
