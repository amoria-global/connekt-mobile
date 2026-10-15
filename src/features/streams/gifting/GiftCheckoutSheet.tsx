/**
 * In-app payment for a catalog gift sent by a registered stream viewer.
 *
 * Uses the same public endpoint the web live page uses for viewers
 * (POST /public/anonymous-viewer/{eventId}/gift). The gift is priced by its
 * code on the server in USD; the amount sent here is ignored by the backend and
 * exists only because the request type requires one.
 */
import { CheckoutSheet, type StartInput } from '@/features/payments/CheckoutSheet';
import { resolveCurrencyId } from '@/features/donations/api';
import { initiateAuthenticatedGift, initiatePublicGift, type GiftCatalogItem } from '@/features/streams/api';
import { formatGiftUsd } from '@/features/streams/gifting/GiftOverlay';
import { getDeviceId } from '@/utils/deviceId';

type GiftRequest = Parameters<typeof initiatePublicGift>[1];

/**
 * The request for one catalog gift. Pure so the rules are pinned by a test:
 * the gift is priced by `giftCode` on the server, so the amount sent is only a
 * placeholder; card sends no phone; the provider is passed through as the operator id, never guessed (a wrong network would charge the wrong number).
 */
export function buildGiftRequest(args: {
  viewerId: string;
  deviceFingerprint: string;
  gift: GiftCatalogItem;
  input: StartInput;
}): GiftRequest {
  const { viewerId, deviceFingerprint, gift, input } = args;
  return {
    viewerId,
    deviceFingerprint,
    amount: gift.amountUsd,
    currencyId: resolveCurrencyId('USD'),
    giftCode: gift.code,
    paymentMethod: input.card ? 'CARD' : 'MOMO',
    ...(input.card
      ? {}
      : {
          phone: input.phone,
          telecomProvider: input.telecomProvider,
        }),
  };
}

type AuthGiftRequest = Parameters<typeof initiateAuthenticatedGift>[0];

/** Request for a signed-in sender. Same rules as buildGiftRequest, no viewer or device. */
export function buildAuthGiftRequest(args: {
  eventId: string;
  gift: GiftCatalogItem;
  input: StartInput;
}): AuthGiftRequest {
  const { eventId, gift, input } = args;
  return {
    eventId,
    giftCode: gift.code,
    currencyId: resolveCurrencyId('USD'),
    paymentMethod: input.card ? 'CARD' : 'MOBILE_MONEY',
    ...(input.card ? {} : { phone: input.phone, telecomProvider: input.telecomProvider }),
  };
}

export function GiftCheckoutSheet({
  visible,
  onClose,
  onSettled,
  eventId,
  viewerId,
  gift,
  eventTitle,
}: {
  visible: boolean;
  onClose: () => void;
  onSettled?: () => void;
  eventId: string;
  /** A registered stream viewer's id. Omit for a signed-in account. */
  viewerId?: string;
  gift: GiftCatalogItem | null;
  eventTitle?: string;
}) {
  if (!gift) return null;

  const start = async (input: StartInput) => {
    const res = viewerId
      ? await initiatePublicGift(
          eventId,
          buildGiftRequest({ viewerId, deviceFingerprint: await getDeviceId(), gift, input }),
        )
      : await initiateAuthenticatedGift(buildAuthGiftRequest({ eventId, gift, input }));
    if (!res.refid) throw { status: 400, message: res.message || 'Could not start the gift payment.' };
    return { refid: res.refid, paymentUrl: res.paymentUrl };
  };

  return (
    <CheckoutSheet
      visible={visible}
      onClose={onClose}
      onSettled={onSettled}
      resetKey={`gift:${eventId}:${gift.code}:${viewerId ?? 'account'}`}
      start={start}
      heading="Send gift"
      title={`${gift.emoji} ${gift.name}`}
      subtitle={eventTitle}
      amountLabel={formatGiftUsd(gift.amountUsd)}
    />
  );
}
