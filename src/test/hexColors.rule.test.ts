import * as fs from 'fs';
import * as path from 'path';

/**
 * Midnight Glass: no hex colour outside src/theme. ESLint fails a hex literal in any file not on
 * eslint/hex-colors-pending.json, the files still waiting for their screen's migration. This keeps
 * that list honest: a file leaves it the moment it is clean, and nothing new joins it.
 */
const ROOT = path.join(__dirname, '..', '..');
const HEX = /['"`]#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"`]/;
const pending: string[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'eslint/hex-colors-pending.json'), 'utf8'));

/** The size of the list when the rule landed; it may only go down. */
const BASELINE = 147;

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['_design-sandbox', 'node_modules', '__fixtures__', 'theme'].includes(e.name)) files(full, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('hex colours', () => {
  // The blocking gate: CI's lint step is advisory, `yarn test` is not.
  it('appear in no file outside src/theme and the pending list', () => {
    const listed = new Set(pending);
    const offenders = files(path.join(ROOT, 'src'))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter((rel) => !listed.has(rel) && HEX.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('lists only files that still carry a hex colour', () => {
    const clean = pending.filter((f) => {
      const full = path.join(ROOT, f);
      return !fs.existsSync(full) || !HEX.test(fs.readFileSync(full, 'utf8'));
    });
    expect(clean).toEqual([]);
  });

  it('never grows the pending list', () => {
    expect(pending.length).toBeLessThanOrEqual(BASELINE);
    expect(new Set(pending).size).toBe(pending.length);
    expect(pending.every((f) => !f.startsWith('src/theme/'))).toBe(true);
  });
});
