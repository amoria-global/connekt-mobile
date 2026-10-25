/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

/**
 * Keeps the Help button honest as the app changes around it. It is mounted once in the root layout, and it steps aside
 * or lifts by screen name, so a renamed screen or a new bottom-right button would quietly put it on top of something.
 * These fail loudly instead.
 */
const SRC = path.resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('the Help button is on every screen because the root layout mounts it', () => {
  const layout = read('app/_layout.tsx');

  it('mounts it exactly once, outside the navigators, so it persists across every screen', () => {
    expect(layout.match(/<GlobalHelpButton\b/g)).toHaveLength(1);
    const stack = layout.indexOf('<Stack screenOptions');
    expect(stack).toBeGreaterThan(0);
    expect(layout.indexOf('<GlobalHelpButton')).toBeGreaterThan(layout.indexOf('</Stack>'));
  });

  it('keeps it beneath the blocking update prompt, so a mandatory update cannot be bypassed from the button', () => {
    expect(layout.indexOf('<GlobalHelpButton')).toBeLessThan(layout.indexOf('<UpdatePromptModal'));
  });

  it('opens a screen that exists', () => {
    expect(existsSync(path.join(SRC, 'app/(public)/help-center/index.tsx'))).toBe(true);
    // And it is registered in the public stack, which is reachable signed in or out.
    expect(read('app/(public)/_layout.tsx')).toContain('help-center/index');
  });
});

describe('the screens it steps aside on still exist under those names', () => {
  it.each([
    'app/(public)/help-center/index.tsx',
    'app/(public)/contact_us.tsx',
    'app/(public)/feedback.tsx',
    'app/(app)/conversation/[id].tsx',
    'app/(app)/stream/[id].tsx',
    'app/(app)/stream/control',
    'app/(public)/events/live-stream.tsx',
    'app/(app)/kyc.tsx',
    'app/(app)/event/new.tsx',
    'app/(app)/event/hybrid-wizard.tsx',
    'app/(app)/album/new.tsx',
    'app/(onboarding)/welcome.tsx',
    'app/(onboarding)/terms.tsx',
  ])('%s', (rel) => {
    expect(existsSync(path.join(SRC, rel))).toBe(true);
  });
});

describe('floating add buttons', () => {
  // Midnight Glass: nothing floats over a button. Create lives in the header or title row (HeaderAddButton).
  it('are drawn on no screen', () => {
    const importers = sourceFiles(SRC)
      .filter((f) => /from '@\/components\/ui\/Fab'/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(importers).toEqual([]);
  });
});
