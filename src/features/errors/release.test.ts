jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.3.2' } } }));
jest.mock('@/features/updates/useAppUpdates', () => ({ getUpdates: () => null }));

import { currentBuild, describeBuild } from './release';

/** Every report names the app version and, for an over-the-air update, which update, so a fix can be tied to a release. */
describe('describeBuild', () => {
  it('names an OTA update by version and the first 8 characters of its id', () => {
    const b = describeBuild({ version: '2.3.2', updateId: 'a1b2c3d4-0000-4000-8000-000000000000', isEmbeddedLaunch: false, runtimeVersion: '2.3.2', channel: 'production' });
    expect(b.release).toBe('2.3.2+ota.a1b2c3d4');
    expect(b.dist).toBe('a1b2c3d4');
    expect(b.tags).toMatchObject({ app_version: '2.3.2', js_source: 'ota', update_id: 'a1b2c3d4-0000-4000-8000-000000000000', runtime_version: '2.3.2', channel: 'production' });
  });

  it('is embedded when the JavaScript came with the store build, even if an update id exists', () => {
    const b = describeBuild({ version: '2.3.2', updateId: 'a1b2c3d4-0000', isEmbeddedLaunch: true });
    expect(b.release).toBe('2.3.2+embedded');
    expect(b.tags.js_source).toBe('embedded');
    expect(b.tags).not.toHaveProperty('update_id');
  });

  it('never carries anything about the person', () => {
    expect(JSON.stringify(describeBuild({ version: '2.3.2', updateId: 'u', isEmbeddedLaunch: false }))).not.toMatch(/@|\+250/);
  });

  it('falls back to the embedded build where expo-updates is unavailable', () => {
    expect(currentBuild().release).toBe('2.3.2+embedded');
  });
});
