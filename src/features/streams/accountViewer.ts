/**
 * Joining a free live stream's chat as a signed-in account. Comments and video messages are sent under a viewer id, which a
 * guest gets by typing a name and an email. An account already has both, so it is registered as a viewer from them, with no
 * form. This is what stopped signed-in users being asked for their name and email before every video message.
 *
 * Paid events are not covered: their access is matched to a purchase made under a name, email and phone, so the person
 * verifies those (the form is prefilled from the account).
 */
import { registerAnonymousViewer } from '@/features/streams/api';
import type { Identity } from '@/features/events/guestIdentity';
import { storage } from '@/services/storage';
import { getDeviceId } from '@/utils/deviceId';

/** Free events collect no phone; the register endpoint still wants one, and the form path sends the same placeholder. */
const NO_PHONE = '0000000000';

/** The new viewer id, or undefined when the account cannot be registered silently (the form is then shown). */
export async function registerAccountViewer(
  eventId: string,
  account: Identity | null,
  opts: { paid: boolean },
): Promise<string | undefined> {
  if (!account || opts.paid) return undefined;
  try {
    const reg = await registerAnonymousViewer(eventId, {
      name: account.name,
      email: account.email,
      phone: NO_PHONE,
      deviceId: await getDeviceId(),
    });
    if (!reg.viewerId) return undefined;
    await storage.set(`anonymousViewer_${eventId}`, reg.viewerId).catch(() => {});
    return reg.viewerId;
  } catch {
    return undefined;
  }
}
