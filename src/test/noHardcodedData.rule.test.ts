import * as fs from 'fs';
import * as path from 'path';

/**
 * No data the backend owns may be written into the app. These are the things that were: production currency ids
 * (with a silent RWF default), invented donation amounts and currency lists, a fixed list of event categories,
 * photographer cities and styles, and analytics figures filled in with zeros. A record id belongs to the database, so
 * a UUID literal in app code is refused unless it is the Expo project id.
 */
const ROOT = path.join(__dirname, '..');
const EXPO_PROJECT_ID = 'd81fbfa6-f576-4450-97c6-c443332179be';
const REMOVED = [
  'KNOWN_CURRENCY_UUIDS',
  'resolveCurrencyId',
  'FALLBACK_TIERS',
  'CURRENCY_DEFAULT_TIERS',
  'CATEGORY_CHIPS',
  'POPULAR_LOCATIONS',
  'STANDARD_CATEGORIES',
  'POPULAR_STYLES',
  'defaultCustomerAnalytics',
  'defaultCoordinatorAnalytics',
  'defaultPhotographerAnalytics',
  'Anonymous Supporter',
];

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['_design-sandbox', 'node_modules', '__fixtures__', 'test', 'i18n'].includes(e.name)) files(full, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('no hard-coded backend data', () => {
  const sources = files(ROOT).map((f) => ({ rel: path.relative(ROOT, f).split(path.sep).join('/'), text: fs.readFileSync(f, 'utf8') }));

  it('has no UUID literal in app code (the Expo project id is configuration)', () => {
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const found = sources.flatMap((s) => (s.text.match(uuid) ?? []).filter((u) => u.toLowerCase() !== EXPO_PROJECT_ID).map((u) => `${s.rel}: ${u}`));
    expect(found).toEqual([]);
  });

  it('does not bring back the removed fallbacks and defaults', () => {
    const found = sources.flatMap((s) => REMOVED.filter((name) => s.text.includes(name)).map((name) => `${s.rel}: ${name}`));
    expect(found).toEqual([]);
  });
});
