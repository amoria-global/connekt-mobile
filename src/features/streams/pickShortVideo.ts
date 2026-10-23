/**
 * Records, or picks, a clip of at most one minute for a video wish or a video message: the camera first, the library
 * when the camera is refused or cancelled. Returns null when the person backs out. The one-minute limit is the web's
 * (its recorder stops at 60 seconds).
 */
import * as ImagePicker from 'expo-image-picker';

export const MAX_VIDEO_SECONDS = 60;

export type PickedVideo = { uri: string; name: string; mimeType: string };

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: MAX_VIDEO_SECONDS, quality: 0.7 };

export async function pickShortVideo(): Promise<PickedVideo | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  let result: ImagePicker.ImagePickerResult;
  if (perm.granted) {
    result = await ImagePicker.launchCameraAsync(OPTIONS);
    if (result.canceled) result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  }
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: a.fileName ?? `wish-${Date.now()}.mp4`, mimeType: a.mimeType ?? 'video/mp4' };
}
