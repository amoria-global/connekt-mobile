import * as fs from 'fs';
import * as path from 'path';
import app from '../../app.json';

/**
 * Google Play refuses a release while the foreground service permissions are undeclared in Play Console, and we have no
 * declaration video. The app uses no foreground service, so the manifest must not carry one: our own keep-alive service is
 * gone, and the permissions libraries add (media playback controls) are blocked.
 */
describe('Android foreground services', () => {
  const blocked = (app.expo as unknown as { android: { blockedPermissions: string[] } }).android.blockedPermissions;

  it('blocks every foreground service permission a library could add', () => {
    for (const name of ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'FOREGROUND_SERVICE_SPECIAL_USE']) {
      expect(blocked).toContain(`android.permission.${name}`);
    }
  });

  it('declares no foreground service in the incoming-call module', () => {
    const manifest = fs.readFileSync(
      path.join(__dirname, '../../modules/incoming-call/android/src/main/AndroidManifest.xml'),
      'utf8',
    );
    expect(manifest).not.toMatch(/FOREGROUND_SERVICE/);
    expect(manifest).not.toMatch(/foregroundServiceType/);
    expect(manifest).not.toMatch(/<service/);
  });
});
