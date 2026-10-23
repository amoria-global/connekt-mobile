import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import '@/test/autoUnmount';
import { TAB_BAR_ROW, useStackClearance, useTabBarClearance } from '@/hooks/useScrollClearance';

/**
 * The end-of-scroll rule: a scroll view's last row clears the docked tab bar exactly, or the home indicator on a
 * screen with no bar. A fixed paddingBottom of 100 to 140 on every screen left a band of empty screen below the
 * last card (Explore Events showed about 170pt). A large fixed bottom padding is allowed only when it is
 * conditional on a docked action bar that is actually showing, or on the one screen that owns such a bar.
 */
let mockBottom = 34;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: mockBottom, left: 0, right: 0 }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const read = (hook: () => number) => {
  let v = -1;
  const Probe = () => {
    v = hook();
    return null;
  };
  act(() => {
    TestRenderer.create(<Probe />);
  });
  return v;
};

describe('scroll clearance hooks', () => {
  it('tab screens clear the bar row, the home indicator and a 16pt gap, and nothing more', () => {
    mockBottom = 34;
    expect(read(useTabBarClearance)).toBe(TAB_BAR_ROW + 34 + 16);
    mockBottom = 0;
    expect(read(useTabBarClearance)).toBe(TAB_BAR_ROW + 8 + 16);
  });

  it('screens with no bar clear the home indicator plus a gap', () => {
    mockBottom = 34;
    expect(read(useStackClearance)).toBe(34 + 24);
    mockBottom = 0;
    expect(read(useStackClearance)).toBe(12 + 24);
  });
});

const ROOT = path.join(__dirname, '..');
// The photographer profile docks its own booking bar over the scroll view.
const OWNS_DOCKED_BAR = ['app/(app)/photographer/[id].tsx'];

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '_design-sandbox' && e.name !== 'node_modules') files(full, out);
    } else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('no fixed end-of-scroll padding', () => {
  it('has no unconditional paddingBottom of 100 or more, or inset plus 60 or more, in a screen or feature', () => {
    const bad: string[] = [];
    for (const f of files(ROOT)) {
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      if (OWNS_DOCKED_BAR.includes(rel)) continue;
      fs.readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const m = line.match(/paddingBottom:\s*(?:Math\.max\(insets\.bottom \+ (\d+)|(\d{3}))/);
          if (!m) return;
          const n = Number(m[1] ?? m[2]);
          const conditional = /&&|\?/.test(line);
          if (n >= (m[1] ? 60 : 100) && !conditional) bad.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(bad).toEqual([]);
  });
});
