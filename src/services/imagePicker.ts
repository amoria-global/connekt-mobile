/**
 * Cross-platform image picking (camera selfie + library), returning a shape
 * ready for multipart upload. On web, camera falls back to the library picker.
 */
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; name: string; type: string };

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const name = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
  return { uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' };
}

/**
 * Walk the user to the system settings if the OS told us we can't ask
 * again. Without this prompt the camera tile silently does nothing on
 * a re-tap and looks broken.
 */
function promptOpenSettings(scope: 'camera' | 'photos') {
  Alert.alert(
    scope === 'camera' ? 'Camera access required' : 'Photo library access required',
    scope === 'camera'
      ? 'Connekyt needs the camera to capture your selfie. Enable it in Settings to continue.'
      : 'Connekyt needs photo library access to upload a picture. Enable it in Settings to continue.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => undefined) },
    ],
  );
}

export async function pickFromLibrary(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    if (perm.canAskAgain === false) promptOpenSettings('photos');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    mediaTypes: ['images'],
  });
  if (res.canceled || !res.assets?.length) return null;
  return toPicked(res.assets[0]);
}

/** Pick several photos at once (for album uploads). */
export async function pickMultipleFromLibrary(limit = 30): Promise<PickedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    if (perm.canAskAgain === false) promptOpenSettings('photos');
    return [];
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
  });
  if (res.canceled || !res.assets?.length) return [];
  return res.assets.map(toPicked);
}

/**
 * Launches the camera straight to the front-facing lens for a selfie.
 *
 *   • `mediaTypes: ['images']` is REQUIRED in expo-image-picker 17+ to
 *     prevent the OS from showing a "Photo or video?" chooser sheet
 *     (which the user was seeing as "a modal to upload picture").
 *   • If the device has no front camera (some low-end Androids), the
 *     OS falls back to the rear camera automatically.
 *   • Permission-denied paths now surface a "open settings" Alert
 *     instead of silently returning null — that turned a tap into a
 *     no-op which the user couldn't recover from.
 *   • Web has no camera API surface available, so we route to the
 *     library picker as before.
 */
export async function takeSelfie(): Promise<PickedImage | null> {
  if (Platform.OS === 'web') return pickFromLibrary();
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    if (perm.canAskAgain === false) promptOpenSettings('camera');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
  });
  if (res.canceled || !res.assets?.length) return null;
  return toPicked(res.assets[0]);
}
