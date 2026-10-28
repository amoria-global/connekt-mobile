import app from '../../app.json';

/**
 * The https wish link (connekyt.com/wish/<id>) opens the app. This is native config, so it only reaches phones with a new
 * store build; the landing site serves the matching apple-app-site-association and assetlinks.json files.
 */
describe('universal links for the wish link', () => {
  const expo = app.expo as unknown as {
    ios: { associatedDomains: string[]; bundleIdentifier: string };
    android: { intentFilters: { action: string; autoVerify: boolean; data: { scheme: string; host: string; pathPrefix: string }[]; category: string[] }[] };
    scheme: string;
  };

  it('claims connekyt.com on iOS', () => {
    expect(expo.ios.associatedDomains).toEqual(['applinks:connekyt.com']);
  });

  it('claims https://connekyt.com/wish on Android, auto-verified, browsable', () => {
    const [filter] = expo.android.intentFilters;
    expect(filter.action).toBe('VIEW');
    expect(filter.autoVerify).toBe(true);
    expect(filter.data).toEqual([{ scheme: 'https', host: 'connekyt.com', pathPrefix: '/wish' }]);
    expect(filter.category).toEqual(['BROWSABLE', 'DEFAULT']);
  });

  it('keeps the custom scheme, which already opens the wish screen', () => {
    expect(expo.scheme).toBe('connekt');
  });
});
