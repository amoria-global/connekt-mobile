import { ErrorSheetHost } from './ErrorSheet';
import { ToastHost } from './Toast';

/**
 * Mounts the two overlays the error system can raise from anywhere: the toast and the decision sheet. Mounted once in
 * the root layout so every area (auth, public, app) can show them. Banners and full-screen errors are placed by the
 * screen that owns them, because they belong to a screen's layout, not above it.
 */
export function ErrorHost() {
  return (
    <>
      <ToastHost />
      <ErrorSheetHost />
    </>
  );
}
