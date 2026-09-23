/**
 * Cross-platform image picking (camera selfie + library), returning a shape
 * ready for multipart upload. On web, camera falls back to the library picker.
 */
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; name: string; type: string };

/**
 * Uploads are rejected outright by the API unless the declared type is JPEG or
 * PNG, and an iPhone library pick reports `image/heic` — so a HEIC cover was
 * refused while the app reported nothing. `asset.mimeType` describes the
 * *source* photo, but every pick here goes through `quality`, which makes the
 * picker re-encode; the file it actually wrote is what the extension on
 * `asset.uri` says. Trust that, and fall back to JPEG (what the re-encode
 * produces) rather than a source type the server will not take.
 */
function mimeFor(uri: string, fallback?: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  // Only keep the reported type when the API will accept it.
  if (fallback === 'image/png' || fallback === 'image/jpeg' || fallback === 'image/jpg') {
    return fallback;
  }
  return 'image/jpeg';
}

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const type = mimeFor(asset.uri, asset.mimeType ?? undefined);
  const ext = type === 'image/png' ? 'png' : 'jpg';
  // Keep the filename's extension consistent with the type we declare — the
  // server builds the stored filename from it, and a .heic name would be
  // served to browsers that cannot render it.
  const base = (asset.fileName || asset.uri.split('/').pop() || 'photo').replace(/\.[^./]+$/, '');
  return { uri: asset.uri, name: `${base}.${ext}`, type };
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
    quality: 0.5,
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
    quality: 0.5,
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
    quality: 0.5,
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
  });
  if (res.canceled || !res.assets?.length) return null;
  return toPicked(res.assets[0]);
}

/**
 * Front-camera selfie as a JPEG data URL, for endpoints that take the image
 * inline in JSON (withdrawal face verification) rather than as multipart.
 * Same permission handling and web fallback as takeSelfie.
 */
export async function takeSelfieDataUrl(): Promise<{ uri: string; dataUrl: string } | null> {
  let res: ImagePicker.ImagePickerResult;
  if (Platform.OS === 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ['images'], base64: true });
  } else {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain === false) promptOpenSettings('camera');
      return null;
    }
    res = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      base64: true,
    });
  }
  const asset = res.canceled ? undefined : res.assets?.[0];
  if (!asset?.base64) return null;
  return { uri: asset.uri, dataUrl: `data:image/jpeg;base64,${asset.base64}` };
}

/**
 * Launches the camera straight to the rear-facing lens for document capture.
 */
export async function takeDocumentPhoto(): Promise<PickedImage | null> {
  if (Platform.OS === 'web') return pickFromLibrary();
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    if (perm.canAskAgain === false) promptOpenSettings('camera');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.back,
  });
  if (res.canceled || !res.assets?.length) return null;
  return toPicked(res.assets[0]);
}

