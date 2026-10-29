import { HELP_ARTICLE_COUNT, HELP_CATEGORIES, findCategory, searchHelp } from './helpCenter';

describe('Help Center content', () => {
  it('keeps the six ids that older links used', () => {
    for (const id of ['my-account', 'payment', 'security', 'payment-methods', 'booking', 'technical-support']) {
      expect(findCategory(id)).toBeDefined();
    }
  });

  it('has unique category and article ids and real content in every article', () => {
    expect(new Set(HELP_CATEGORIES.map((c) => c.id)).size).toBe(HELP_CATEGORIES.length);
    for (const c of HELP_CATEGORIES) {
      expect(c.articles.length).toBeGreaterThan(0);
      expect(new Set(c.articles.map((a) => a.id)).size).toBe(c.articles.length);
      for (const a of c.articles) {
        expect(a.title.length).toBeGreaterThan(3);
        expect(a.summary.length).toBeGreaterThan(10);
        expect(a.blocks.length).toBeGreaterThan(0);
      }
    }
    expect(HELP_ARTICLE_COUNT).toBe(HELP_CATEGORIES.reduce((n, c) => n + c.articles.length, 0));
  });

  it('uses no em or en dashes in what users read', () => {
    expect(JSON.stringify(HELP_CATEGORIES)).not.toMatch(/[–—]/);
  });

  it('does not send people to the website to buy', () => {
    expect(JSON.stringify(HELP_CATEGORIES).toLowerCase()).not.toMatch(/connekyt\.com|website|on the web/);
  });

  it('finds articles by any word in the title or body, best title match first', () => {
    const hits = searchHelp('withdraw');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].article.id).toBe('withdraw');
    expect(searchHelp('obs encoder')[0].article.id).toBe('go-live');
    expect(searchHelp('   ')).toEqual([]);
    expect(searchHelp('zzzzqqq')).toEqual([]);
  });
});
