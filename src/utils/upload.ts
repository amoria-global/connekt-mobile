/**
 * Cross-platform multipart file append.
 *
 * React Native's FormData accepts a `{ uri, name, type }` object and
 * streams the file from disk. A BROWSER's FormData does not — that object
 * serialises to the string "[object Object]", so the backend sees no file
 * and rejects the request ("Required part 'selfie' is missing"). On Expo
 * web we must fetch the picked `blob:`/`data:` uri into a real Blob and
 * append THAT (with a filename). This helper picks the right form per
 * platform so a single call site works on iOS, Android and web.
 */
import { Platform } from 'react-native';

export type UploadFile = { uri: string; name?: string; type?: string };

export async function appendFile(
  form: FormData,
  field: string,
  file: UploadFile,
): Promise<void> {
  const name = file.name ?? 'upload';
  if (Platform.OS === 'web') {
    const res = await fetch(file.uri);
    const blob = await res.blob();
    form.append(field, blob, name);
  } else {
    form.append(
      field,
      { uri: file.uri, name, type: file.type ?? 'application/octet-stream' } as unknown as Blob,
    );
  }
}
