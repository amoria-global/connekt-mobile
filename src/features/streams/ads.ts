/**
 * Live-stream sponsor ads (public viewer side).
 *
 * Mirrors the web's StreamAdBanners flow, backed by the backend's
 * PublicStreamAdController:
 *   GET  /public/events/{id}/ads          → { data: { ads[], schedule } }
 *   GET  /public/events/{id}/ads/trigger  → { data: { trigger } }  (manual push)
 *   POST /public/events/{id}/ads/{adId}/click  → record a click-through
 *
 * Ads render OVER the video at a placement encoded by `adType` (top / bottom /
 * left / right / corners / edges / L-shape). A viewer may only dismiss an ad
 * when `closable` is true — otherwise no close button is shown.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

export type StreamAd = {
  id: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  videoUrl?: string;
  logoUrl?: string;
  ctaText?: string;
  /** Click-through URL. When present the whole ad is tappable. */
  ctaUrl?: string;
  brandColor?: string;
  /** Placement key — see StreamAdOverlay's placementFor(). */
  adType: string;
  /** Seconds to keep the ad on screen; 0 / undefined = persistent. */
  duration: number;
  /** Whether the viewer is allowed to dismiss it (renders a close button). */
  closable: boolean;
};

export type StreamAdSchedule = {
  intervalSeconds: number;
  startAfterSeconds: number;
  enabled: boolean;
};

export type StreamAdsResult = { ads: StreamAd[]; schedule: StreamAdSchedule };

function mapAd(r: Raw): StreamAd {
  return {
    id: String(r.id ?? ''),
    title: str(r.title),
    subtitle: str(r.subtitle),
    imageUrl: str(r.imageUrl) ?? str(r.bannerImage),
    videoUrl: str(r.videoUrl) ?? str(r.bannerVideo),
    logoUrl: str(r.logoUrl) ?? str(r.brandLogo),
    ctaText: str(r.ctaText),
    ctaUrl: str(r.ctaUrl),
    brandColor: str(r.brandColor),
    adType: (str(r.adType) ?? str(r.type) ?? 'glass_bottom').toLowerCase(),
    duration: num(r.duration) ?? 0,
    closable: r.closable === true,
  };
}

/** Fetch the active ads + rotation schedule for a live event. */
export async function getStreamAds(eventId: string): Promise<StreamAdsResult> {
  const res = await api.get<ApiEnvelope<Raw> & Raw>(
    `/public/events/${encodeURIComponent(eventId)}/ads`,
    { skipAuth: true },
  );
  const data = (res?.data ?? {}) as Raw;
  const rawAds = Array.isArray(data.ads) ? (data.ads as Raw[]) : [];
  const sched = (data.schedule ?? {}) as Raw;
  return {
    ads: rawAds.map(mapAd).filter((a) => a.id && (a.imageUrl || a.videoUrl)),
    schedule: {
      intervalSeconds: num(sched.intervalSeconds) ?? 300,
      startAfterSeconds: num(sched.startAfterSeconds) ?? 30,
      enabled: sched.enabled === true,
    },
  };
}

/**
 * Poll for a manually-pushed ad. The organizer can trigger an ad to show
 * immediately from their dashboard; this consumes the pending trigger and
 * returns the ad id to display (or null when nothing is pending).
 */
export async function getPendingAdTrigger(eventId: string): Promise<string | null> {
  const res = await api.get<ApiEnvelope<Raw> & Raw>(
    `/public/events/${encodeURIComponent(eventId)}/ads/trigger`,
    { skipAuth: true },
  );
  const data = (res?.data ?? {}) as Raw;
  const trigger = (data.trigger ?? {}) as Raw;
  return str(trigger.adId) ?? null;
}

/** Record a click-through so the advertiser's stats reflect it. */
export async function recordAdClick(
  eventId: string,
  adId: string,
  viewerId?: string,
): Promise<void> {
  try {
    await api.post(
      `/public/events/${encodeURIComponent(eventId)}/ads/${encodeURIComponent(adId)}/click`,
      viewerId ? { viewerId } : {},
      { skipAuth: true },
    );
  } catch {
    /* click tracking is best-effort — never block opening the link */
  }
}
