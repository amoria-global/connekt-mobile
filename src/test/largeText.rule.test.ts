import * as fs from 'fs';
import * as path from 'path';

/**
 * The large-text rule: content text follows the system font scale up to 1.6x.
 *
 * A `maxFontSizeMultiplier` below 1.6 caps text so that at the 1.6x setting it grows only 1.1 to 1.4x, and
 * `allowFontScaling={false}` pins it entirely. Both were scattered through content screens and cards. They are
 * allowed only in chrome that has a fixed height by design (tab bar, brand pill, photo viewer controls, chat input,
 * live pill, flag glyphs, gift send chip); any other use fails here so it has to be argued for in review.
 */
const ROOT = path.join(__dirname, '..');
const CHROME_ALLOWLIST = [
  'components/PersistentBottomBar.tsx',
  'components/topbar/BrandPill.tsx',
  'components/ui/live/Live.tsx',
  'components/ui/PhoneInput.tsx',
  'features/gallery/PhotoViewer.tsx',
  'features/streams/viewer/components/ChatInput.tsx',
  'features/streams/gifting/GiftTray.tsx',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_design-sandbox' || entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('large text rule', () => {
  const files = sourceFiles(ROOT).map((f) => ({ rel: path.relative(ROOT, f).split(path.sep).join('/'), text: fs.readFileSync(f, 'utf8') }));

  it('no content component caps text below 1.6x', () => {
    const offenders: string[] = [];
    for (const { rel, text } of files) {
      if (CHROME_ALLOWLIST.includes(rel)) continue;
      for (const m of text.matchAll(/maxFontSizeMultiplier=\{([0-9.]+)\}/g)) {
        if (Number(m[1]) < 1.6) offenders.push(`${rel}: maxFontSizeMultiplier=${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no content component turns font scaling off', () => {
    const offenders: string[] = [];
    for (const { rel, text } of files) {
      if (CHROME_ALLOWLIST.includes(rel)) continue;
      if (/allowFontScaling=\{false\}/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('the allowlist only names files that exist (so a rename cannot silently widen it)', () => {
    const present = new Set(files.map((f) => f.rel));
    expect(CHROME_ALLOWLIST.filter((f) => !present.has(f))).toEqual([]);
  });
});
