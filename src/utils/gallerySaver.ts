/**
 * Gallery Saver Utility
 * Downloads photos and automatically saves them directly to the device's
 * photo gallery / camera roll (Apple Photos / Google Photos / Gallery)
 * without requiring intermediate share dialogs.
 */
import { Alert } from 'react-native';
import { downloadAsync, cacheDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

export type SavePhotoResult = {
  success: boolean;
  savedToGallery: boolean;
  localUri?: string;
  error?: string;
};

/**
 * Downloads a photo from `url` and automatically saves it directly
 * to the device's Photos / Gallery without extra manual configuration.
 *
 * If permissions are denied or unavailable, it falls back
 * gracefully to the native sharing sheet.
 */
export async function savePhotoToGallery(
  url: string,
  filename: string,
  options?: { notifyOnSuccess?: boolean; customSuccessMessage?: string }
): Promise<SavePhotoResult> {
  try {
    const localUri = (cacheDirectory ?? '') + filename;
    const downloadResult = await downloadAsync(url, localUri);
    const downloadedUri = downloadResult.uri;

    // Check / request media library write permissions
    let savedDirectly = false;
    try {
      const { status } = await requestPermissionsAsync(true);
      if (status === 'granted') {
        await Asset.create(downloadedUri);
        savedDirectly = true;
      }
    } catch (permErr) {
      console.warn('MediaLibrary permission / create error:', permErr);
    }

    if (savedDirectly) {
      if (options?.notifyOnSuccess) {
        Alert.alert(
          'Saved to Photos',
          options.customSuccessMessage ||
            'Your high-resolution photo has been saved directly to your camera roll.',
          [{ text: 'OK' }]
        );
      }
      return { success: true, savedToGallery: true, localUri: downloadedUri };
    }

    // Fallback: If direct gallery permission not granted, launch native share sheet
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloadedUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Save or Share Photo',
      });
      return { success: true, savedToGallery: false, localUri: downloadedUri };
    }

    return { success: true, savedToGallery: false, localUri: downloadedUri };
  } catch (err: any) {
    console.error('Error saving photo to gallery:', err);
    return {
      success: false,
      savedToGallery: false,
      error: err instanceof Error ? err.message : 'Failed to download photo',
    };
  }
}

/**
 * Batch saves multiple photos directly into the device's Photos / Gallery.
 */
export async function saveBatchPhotosToGallery(
  items: { url: string; filename: string }[],
  onProgress?: (current: number, total: number) => void
): Promise<{ total: number; saved: number; failed: number }> {
  let hasPermission = false;
  try {
    const { status } = await requestPermissionsAsync(true);
    hasPermission = status === 'granted';
  } catch {
    hasPermission = false;
  }

  let saved = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length);

    try {
      const localUri = (cacheDirectory ?? '') + item.filename;
      const { uri } = await downloadAsync(item.url, localUri);

      if (hasPermission) {
        await Asset.create(uri);
        saved++;
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
        saved++;
      } else {
        failed++;
      }
    } catch (e) {
      console.warn(`Failed to save ${item.filename}:`, e);
      failed++;
    }
  }

  return { total: items.length, saved, failed };
}
