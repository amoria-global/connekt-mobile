/**
 * @jest-environment node
 */
import path from 'node:path';
import { compileModsAsync } from '@expo/config-plugins';
import { getPrebuildConfigAsync } from '@expo/prebuild-config';

/**
 * Play's Photo and Video Permissions policy.
 *
 * On 2026-09-23 Google Play rejected the release because the manifest asked
 * for READ_MEDIA_IMAGES and READ_MEDIA_VIDEO. Apps targeting Android 13+ may
 * only hold them when the system photo picker cannot do the job, and here it
 * can: expo-image-picker already opens the Android photo picker
 * (PickVisualMedia) and asks for no permission on Android 13+, and saving a
 * purchased photo goes through MediaStore, which needs none either.
 *
 * Nothing in our code requested them. expo-media-library's config plugin adds
 * READ_MEDIA_IMAGES, _VIDEO and _AUDIO by default, and expo-screen-capture's
 * library manifest adds READ_MEDIA_IMAGES for Android 13. So the fix lives in
 * app.json, and this test reads the manifest the build will actually get, so a
 * new plugin that brings one back fails here instead of in Play review.
 */
const FORBIDDEN = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

type UsesPermission = { $: { 'android:name': string; 'tools:node'?: string } };

async function manifestPermissions(): Promise<UsesPermission[]> {
  const projectRoot = path.resolve(__dirname, '../..');
  const { exp } = await getPrebuildConfigAsync(projectRoot, { platforms: ['android'] });
  const config = await compileModsAsync(exp, {
    projectRoot,
    platforms: ['android'],
    introspect: true,
    assertMissingModProviders: false,
  });
  const manifest = (config as any)._internal?.modResults?.android?.manifest;
  return manifest?.manifest?.['uses-permission'] ?? [];
}

describe('Android manifest permissions', () => {
  let permissions: UsesPermission[];

  beforeAll(async () => {
    permissions = await manifestPermissions();
  }, 60_000);

  it.each(FORBIDDEN)('does not request %s', (name) => {
    const requested = permissions.filter(
      (p) => p.$['android:name'] === name && p.$['tools:node'] !== 'remove',
    );
    expect(requested).toEqual([]);
  });

  // Libraries declare these in their own manifests, which app.json cannot
  // edit. Only a tools:node="remove" entry strips them at the manifest merge.
  it.each(FORBIDDEN)('strips %s from library manifests at merge', (name) => {
    const removal = permissions.find(
      (p) => p.$['android:name'] === name && p.$['tools:node'] === 'remove',
    );
    expect(removal).toBeDefined();
  });

  it('keeps the permissions the app does use', () => {
    const names = permissions
      .filter((p) => p.$['tools:node'] !== 'remove')
      .map((p) => p.$['android:name']);
    expect(names).toEqual(
      expect.arrayContaining([
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.POST_NOTIFICATIONS',
      ]),
    );
  });
});
