/**
 * Save the wish QR as a PNG in the photo library. The PNG is built in JS (qrPng.ts) and written to the cache, then
 * added through expo-media-library, which the installed build already carries (utils/gallerySaver.ts uses it).
 * Returns false when photo access was refused, so the caller can say so; the caller treats a throw as a failure.
 */
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import { bytesToBase64, qrPngBytes } from './qrPng';

export async function saveQrToPhotos(link: string, eventId: string): Promise<boolean> {
  const MediaLibrary: typeof import('expo-media-library') = require('expo-media-library'); // eslint-disable-line @typescript-eslint/no-require-imports
  const { status } = await MediaLibrary.requestPermissionsAsync(true);
  if (status !== 'granted') return false;
  const uri = `${cacheDirectory ?? ''}connekyt-wish-qr-${eventId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24)}.png`;
  await writeAsStringAsync(uri, bytesToBase64(qrPngBytes(link)), { encoding: EncodingType.Base64 });
  await MediaLibrary.Asset.create(uri);
  return true;
}
