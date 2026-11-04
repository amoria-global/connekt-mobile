import { requireOptionalNativeModule } from 'expo';
import { Platform, Share } from 'react-native';

/**
 * Copy text to the clipboard on every installed build.
 *
 * Builds that carry the `expo-clipboard` native module copy straight to the clipboard. Older store builds do not
 * have it, and a JavaScript update cannot add native code, so there the system share sheet opens instead, which
 * has a Copy action. The module is looked up optionally, so a build without it never crashes on this import.
 *
 * The `expo-clipboard` package is added to package.json only together with the next store build, so the OTA
 * compatibility gate keeps matching the installed natives (see docs/RELEASING.md).
 */
type ClipboardNative = {
  setStringAsync?: (text: string, options: Record<string, unknown>) => Promise<boolean>;
};

const native = requireOptionalNativeModule<ClipboardNative>('ExpoClipboard');

/** `copied`: it is on the clipboard. `shared`: handed to the share sheet. `cancelled`: the sheet was dismissed. */
export type CopyResult = 'copied' | 'shared' | 'cancelled' | 'failed';

export const canCopyDirectly = (): boolean => typeof native?.setStringAsync === 'function';

export async function copyText(text: string, opts: { sensitive?: boolean } = {}): Promise<CopyResult> {
  if (native?.setStringAsync) {
    try {
      // On Android a sensitive value is kept out of the clipboard preview.
      await native.setStringAsync(text, Platform.OS === 'android' && opts.sensitive ? { isSensitive: true } : {});
      return 'copied';
    } catch {
      // Fall through to the share sheet rather than report a failure the person cannot act on.
    }
  }
  try {
    const out = await Share.share({ message: text });
    return out.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}
