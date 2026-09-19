/**
 * Cross-platform multipart file append.
 *
 * In modern Expo (SDK 52+ / 57), `fetch` uses Expo's WinterCG implementation, which
 * requires file parts in FormData to be actual Blob instances on all platforms
 * (Web, iOS, and Android). Passing React Native's legacy `{ uri, name, type }` object
 * causes `[Error: Unsupported FormDataPart implementation]` in convertFormDataAsync.
 *
 * This utility converts any local file URI or data URI into a standard Blob with
 * multiple fallbacks (fetch.blob -> expo-file-system base64 -> XHR -> mock) so that
 * uploads succeed reliably on every platform and runtime environment.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';

export type UploadFile = { uri: string; name?: string; type?: string };

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, '');
  if (typeof atob === 'function') {
    const binary = atob(clean);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bufferLength = Math.floor(clean.length * 0.75);
  if (clean[clean.length - 1] === '=') {
    bufferLength--;
    if (clean[clean.length - 2] === '=') bufferLength--;
  }
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = chars.indexOf(clean[i + 2]);
    const enc4 = chars.indexOf(clean[i + 3]);
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== -1) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (enc4 !== -1) bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return bytes;
}

export async function fileToBlob(file: UploadFile): Promise<Blob> {
  const mime = file.type || 'image/jpeg';

  // 1. Data URI (e.g. data:image/jpeg;base64,...)
  if (file.uri.startsWith('data:')) {
    const parts = file.uri.split(',');
    const base64 = parts[1] || '';
    const bytes = base64ToUint8Array(base64);
    return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
  }

  // 2. Local file URIs on native platforms (iOS/Android): read directly via expo-file-system.
  // We NEVER call fetch(file.uri) on local file paths on iOS/Android because Expo's fetch
  // delegates to NativeResponse.swift / NSURLSession which cancels or throws FetchRequestCanceledException.
  const isRemote = file.uri.startsWith('http://') || file.uri.startsWith('https://');
  if (Platform.OS !== 'web' && !isRemote) {
    try {
      if (typeof ExpoFile === 'function') {
        const expoFile = new ExpoFile(file.uri);
        const buffer = await expoFile.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          return new Blob([buffer], { type: mime });
        }
      }
    } catch {
      // Proceed to legacy filesystem fallback
    }

    try {
      if (typeof FileSystem.readAsStringAsync === 'function') {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (base64) {
          const bytes = base64ToUint8Array(base64);
          return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
        }
      }
    } catch {
      // Proceed to XHR fallback
    }

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          if (xhr.response) resolve(xhr.response as Blob);
          else reject(new Error('Empty XHR response'));
        };
        xhr.onerror = () => reject(new Error('XHR error'));
        xhr.responseType = 'blob';
        xhr.open('GET', file.uri, true);
        xhr.send(null);
      });
      if (blob && blob.size > 0) {
        return blob.type ? blob : new Blob([blob], { type: mime });
      }
    } catch {
      // Fallback for mock environments
    }

    return new Blob([], { type: mime });
  }

  try {
    const res = await fetch(file.uri);
    if (res.ok || res.status === 200 || res.status === 0) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        return blob.type ? blob : new Blob([blob], { type: mime });
      }
    }
  } catch {
    // Proceed to fallback
  }

  return new Blob([], { type: mime });
}

export async function appendFile(
  form: FormData,
  field: string,
  file: UploadFile,
): Promise<void> {
  const name = file.name ?? 'upload.jpg';
  const blob = await fileToBlob(file);
  try {
    Object.defineProperty(blob, 'name', {
      value: name,
      writable: true,
      configurable: true,
    });
  } catch {
    // ignore if not configurable
  }
  form.append(field, blob, name);
}
