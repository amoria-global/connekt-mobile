import * as fs from 'fs';
import * as path from 'path';

import { countItems, parseReleases, releasesFromManifest, releasesToShow, unseenReleases } from './releaseNotes';

const r = (id: string, ...titles: string[]) => ({ id, title: `Release ${id}`, items: titles.map((t) => ({ title: t, body: `About ${t}` })) });

describe('release notes parsing', () => {
  it('reads releases newest first with their items', () => {
    const out = parseReleases({ releases: [{ ...r('b', 'One', 'Two'), date: '2026-10-21' }, r('a', 'Zero')] });
    expect(out.map((x) => x.id)).toEqual(['b', 'a']);
    expect(out[0].items.map((i) => i.title)).toEqual(['One', 'Two']);
    expect(out[0].date).toBe('2026-10-21');
    expect(countItems(out)).toBe(3);
  });

  it('drops what is malformed instead of throwing, so a bad entry never blocks an update', () => {
    expect(parseReleases(undefined)).toEqual([]);
    expect(parseReleases({ releases: 'nope' })).toEqual([]);
    const out = parseReleases({ releases: [{ id: 'x' }, { id: 'y', title: 'Y', items: [{ title: 'ok', body: 'fine' }, { title: 'no body' }, { body: 'no title' }, 7] }, { id: 'z', title: 'Z', items: [] }] });
    expect(out.map((x) => x.id)).toEqual(['y']);
    expect(out[0].items).toHaveLength(1);
  });

  it('reads the notes out of an update manifest', () => {
    const manifest = { extra: { expoClient: { extra: { releaseNotes: { releases: [r('m1', 'A')] } } } } };
    expect(releasesFromManifest(manifest).map((x) => x.id)).toEqual(['m1']);
    expect(releasesFromManifest({ extra: {} })).toEqual([]);
    expect(releasesFromManifest(undefined)).toEqual([]);
  });
});

describe('which releases are new to this phone', () => {
  const all = parseReleases({ releases: [r('r4', 'd'), r('r3', 'c'), r('r2', 'b'), r('r1', 'a')] });
  it('shows everything above the release it already runs', () => {
    expect(unseenReleases(all, 'r2').map((x) => x.id)).toEqual(['r4', 'r3']);
    expect(unseenReleases(all, 'r4')).toEqual([]);
  });
  it('shows everything when it runs a build with no notes, or one the list no longer holds', () => {
    expect(unseenReleases(all, undefined)).toHaveLength(4);
    expect(unseenReleases(all, 'r0')).toHaveLength(4);
  });
  it('combines a manifest with what is installed', () => {
    const manifest = { extra: { expoClient: { extra: { releaseNotes: { releases: [r('r3', 'c'), r('r2', 'b')] } } } } };
    expect(releasesToShow(manifest, parseReleases({ releases: [r('r2', 'b')] })).map((x) => x.id)).toEqual(['r3']);
  });
});

/**
 * The notes this repo ships. Every release must carry plain written notes before it is published (docs/RELEASING.md),
 * and nothing in them may be silently dropped by the parser or break the prose rules.
 */
describe('the release notes in app.json', () => {
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app.json'), 'utf8'));
  const raw = app.expo.extra?.releaseNotes;

  it('exist, with the newest release first', () => {
    expect(Array.isArray(raw?.releases)).toBe(true);
    expect(raw.releases.length).toBeGreaterThan(0);
    const dates = raw.releases.map((x: { date?: string }) => x.date ?? '');
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('keep every release and every item (none is dropped as malformed)', () => {
    const parsed = parseReleases(raw);
    expect(parsed).toHaveLength(raw.releases.length);
    parsed.forEach((rel, i) => expect(rel.items).toHaveLength(raw.releases[i].items.length));
  });

  it('use unique release ids', () => {
    const ids = raw.releases.map((x: { id: string }) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('use no em or en dashes, and describe each change in a full sentence', () => {
    const strings: string[] = [];
    for (const rel of raw.releases) {
      strings.push(rel.title);
      for (const it of rel.items) strings.push(it.title, it.body);
    }
    expect(strings.filter((s) => /[–—]/.test(s))).toEqual([]);
    for (const rel of raw.releases) for (const it of rel.items) expect(it.body.length).toBeGreaterThanOrEqual(40);
  });
});
