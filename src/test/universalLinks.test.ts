import app from '../../app.json';

/**
 * The https wish link (connekyt.com/wish/<id>) opens the app on iOS through the associated domain; the landing site serves
 * the matching apple-app-site-association file. Android already claims it, so its link filters must stay exactly as they were.
 */
describe('universal links for the wish link', () => {
  const expo = app.expo as unknown as {
    ios: { associatedDomains: string[] };
    android: { intentFilters: { action: string; autoVerify: boolean; data: { scheme: string; host: string; pathPrefix: string }[] }[] };
    scheme: string;
  };

  it('claims connekyt.com on iOS', () => {
    expect(expo.ios.associatedDomains).toEqual(['applinks:connekyt.com']);
  });

  it('keeps every Android link filter, wish included, on both hosts', () => {
    const data = expo.android.intentFilters.flatMap((f) => f.data);
    for (const host of ['connekyt.com', 'dashboard.connekyt.com']) {
      for (const pathPrefix of ['/offers', '/opportunities', '/bookings', '/jobs', '/events', '/user']) {
        expect(data).toContainEqual({ scheme: 'https', host, pathPrefix });
      }
    }
    expect(data).toContainEqual({ scheme: 'https', host: 'connekyt.com', pathPrefix: '/wish' });
    expect(expo.android.intentFilters.every((f) => f.action === 'VIEW' && f.autoVerify)).toBe(true);
  });

  it('keeps the custom scheme, which already opens the wish screen', () => {
    expect(expo.scheme).toBe('connekt');
  });
});
