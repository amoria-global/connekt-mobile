/**
 * Event QR support.
 *
 * Printed codes encode a connekyt.com link. On a phone the landing page offers
 * "Open in the app", which fires connekt://scan/<eventId>. That lands on
 * (public)/scan/[id], which stores the id here and forwards to the guest event
 * screen. The id is kept (not just passed along) so that if the viewer has to
 * sign in or register first, the root layout can still send them to the very
 * event they scanned once they are authenticated.
 */
import QRCode from 'qrcode';
import { storage } from '@/services/storage';

const KEY = 'connekt.pendingScanEvent';

/** Same link the dashboards encode. src=qr switches on the phone gate on the web page. */
export function eventQrLink(eventId: string): string {
  return `https://connekyt.com/user/events/view-event?id=${encodeURIComponent(eventId)}&src=qr`;
}

/** Ids come from a URL, so accept only what an event id can look like. */
export function sanitizeEventId(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  const id = v.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

/** A scan older than this is stale: do not let it hijack a login days later. */
export const PENDING_SCAN_TTL_MS = 24 * 60 * 60 * 1000;

export async function setPendingScanEvent(eventId: string, now: number = Date.now()): Promise<void> {
  await storage.set(KEY, `${eventId}|${now}`);
}

/** Read and clear. Returns null when nothing is waiting or the scan went stale. */
export async function takePendingScanEvent(now: number = Date.now()): Promise<string | null> {
  const raw = await storage.get(KEY);
  if (!raw) return null;
  await storage.remove(KEY);
  const [idPart, atPart] = raw.split('|');
  const id = sanitizeEventId(idPart);
  const at = Number(atPart);
  if (!id || !Number.isFinite(at) || now - at > PENDING_SCAN_TTL_MS) return null;
  return id;
}

/** Row-major dark-module matrix for drawing the code with react-native-svg. */
export function qrMatrix(link: string): { size: number; dark: boolean[] } {
  const qr = QRCode.create(link, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const dark: boolean[] = new Array(size * size);
  for (let i = 0; i < dark.length; i++) dark[i] = qr.modules.data[i] === 1;
  return { size, dark };
}
