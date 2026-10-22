import * as fs from 'fs';
import * as path from 'path';

/**
 * Every modal in the app uses the shared glass look (components/ui/GlassModal.tsx: GlassScrim, GlassSheetHost, or the
 * Sheet and Alert dialog built on them): a frosted panel over a blurred, dimmed screen. A new `<Modal>` that draws its own
 * solid sheet fails here. The exceptions are full-screen media viewers, incoming-call screens and native page sheets,
 * where a translucent panel would hurt the content. Each is listed with its reason; add to the list only with one.
 */
const ROOT = path.join(__dirname, '..');
const EXEMPT: Record<string, { count: number; why: string }> = {
  'app/(public)/browse-photos.tsx': { count: 1, why: 'full-screen photo lightbox' },
  'app/(public)/events/live-stream.tsx': { count: 1, why: 'full-screen immersive player' },
  'features/gallery/PhotoViewer.tsx': { count: 1, why: 'full-screen photo viewer' },
  'features/photos/FindMyPhotos.tsx': { count: 1, why: 'full-screen photo lightbox' },
  'features/bookings/BookingRequestCallModal.tsx': { count: 1, why: 'incoming booking call screen' },
  'features/hybrid/IncomingOpportunityAlertModal.tsx': { count: 1, why: 'incoming opportunity call screen' },
  'features/updates/UpdatePromptModal.tsx': { count: 1, why: 'full-screen blocking update screen with its own fixed dark gradient' },
  'features/payments/CountrySelectModal.tsx': { count: 1, why: 'native iOS page sheet picker' },
};

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['_design-sandbox', 'node_modules', '__fixtures__'].includes(e.name)) files(full, out);
    } else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('glass modals', () => {
  it('uses the glass kit in every modal except the listed immersive ones', () => {
    const plain: Record<string, number> = {};
    for (const f of files(ROOT)) {
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      const text = fs.readFileSync(f, 'utf8');
      for (const open of text.matchAll(/<Modal[\s>]/g)) {
        const at = open.index ?? 0;
        const end = text.indexOf('</Modal>', at);
        if (end < 0) continue;
        const block = text.slice(at, end);
        if (!/Glass(Scrim|SheetHost|Surface)|RejectSheet/.test(block)) plain[rel] = (plain[rel] ?? 0) + 1;
      }
    }
    const unexpected = Object.entries(plain)
      .filter(([rel, n]) => n !== (EXEMPT[rel]?.count ?? 0))
      .map(([rel, n]) => `${rel}: ${n} modal(s) without the glass kit`);
    expect(unexpected).toEqual([]);
    for (const [rel, e] of Object.entries(EXEMPT)) expect(`${rel}:${plain[rel] ?? 0}`).toBe(`${rel}:${e.count}`);
  });

  it('keeps colour, border and radius out of the host styles of converted modals', () => {
    const bad: string[] = [];
    for (const f of files(ROOT)) {
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/<GlassSheetHost[^>]*style=\{\[?\s*styles\.(\w+)/g)) {
        const obj = text.match(new RegExp(`\n\s*${m[1]}:\s*\{[^}]*\}`));
        if (obj && /backgroundColor|borderRadius|borderTop(Left|Right)Radius|borderColor/.test(obj[0])) bad.push(`${rel}: styles.${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
