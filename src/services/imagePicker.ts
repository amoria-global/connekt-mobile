/**
 * Cross-platform image picking (camera selfie + library), returning a shape
 * ready for multipart upload. On web, camera falls back to the library picker.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; name: string; type: string };

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const name = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
  return { uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' };
}

export async function pickFromLibrary(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
  if (res.canceled || !res.assets?.length) return null;
  return toPicked(res.assets[0]);
}

/** Pick several photos at once (for album uploads). */
export async function pickMultipleFromLibrary(limit = 30): Promise<PickedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsMultipleSelection: true,
    selectionLimit: limit,
  });
  if (res.canceled || !res.assets?.length) return [];
  return res.assets.map(toPicked);
}

export async function takeSelfie(): Promise<PickedImage | null> {
  // Camera isn't available on web — fall back to the library.
  if (Platform.OS === 'web') return pickFromLibrary();
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    cameraType: ImagePicker.CameraType.front,
  });
  if (res.canceled || !res.assets?.length) return null;
  return toPicked(res.assets[0]);
}
