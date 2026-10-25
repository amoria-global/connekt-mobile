import { env } from '@/config/env';
import type { StreamChat, StreamDetail } from '@/features/streams/api';
import type { IconName, ReactionDef, ViewerModel } from './types';

import { darkPalette } from '@/theme';
/** The existing reaction set + keys, sent to the backend exactly as before. */
export const REACTIONS: ReactionDef[] = [
  { key: 'heart', icon: 'heart', color: darkPalette.error, label: 'Heart' },
  { key: 'flame', icon: 'flame', color: darkPalette.pending, label: 'Flame' },
  { key: 'clap', icon: 'hand-left', color: darkPalette.live, label: 'Applause' },
  { key: 'star', icon: 'star', color: darkPalette.pending, label: 'Star' },
  { key: 'rocket', icon: 'rocket', color: darkPalette.primaryLight, label: 'Rocket' },
];

/** UI adapter: existing API shape -> viewer presentation model. */
export function mapStreamToViewerModel(
  routeId: string,
  data: StreamDetail | null,
): ViewerModel {
  const creator = data?.photographerName || 'Connekyt Creator';
  return {
    routeId,
    eventId: data?.eventId ?? routeId,
    title: data?.title || 'Live Broadcast',
    creatorName: creator,
    creatorInitial: creator.charAt(0).toUpperCase() || 'C',
    isLive: !!data?.isLive,
    viewerCount: data?.viewerCount ?? null,
  };
}

/** Compact counts: 1,284 -> "1.3K". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** Same URL the screen shared before the redesign. */
export function buildStreamShareUrl(eventId: string): string {
  return `${env.webBaseUrl}/user/events/live-stream?eventId=${encodeURIComponent(eventId)}&id=${encodeURIComponent(eventId)}`;
}

export function isGiftChat(c: StreamChat): boolean {
  return (c.chatType ?? '').toUpperCase() === 'GIFT';
}

/** Existing host heuristic, unchanged (plus exact creator-name match). */
export function isHostSender(sender: string | undefined, creatorName?: string): boolean {
  const s = (sender || '').toLowerCase();
  if (!s) return false;
  return (
    s.includes('host') ||
    s.includes('photographer') ||
    (!!creatorName && s === creatorName.toLowerCase())
  );
}

export function getGiftIconName(code?: string): IconName {
  if (!code) return 'gift';
  const c = code.toLowerCase();
  if (c.includes('diamond')) return 'diamond';
  if (c.includes('crown') || c.includes('trophy')) return 'trophy';
  if (c.includes('flame') || c.includes('fire')) return 'flame';
  if (c.includes('rocket')) return 'rocket';
  if (c.includes('rose') || c.includes('flower')) return 'flower';
  if (c.includes('heart')) return 'heart';
  if (c.includes('star')) return 'star';
  return 'gift';
}

export function getReactionVisual(key: string): { icon: IconName; color: string } {
  const k = (key || '').toLowerCase();
  const hit = REACTIONS.find((r) => r.key === k);
  if (hit) return { icon: hit.icon, color: hit.color };
  if (k.includes('heart') || k.includes('love') || key === '❤️') return { icon: 'heart', color: darkPalette.error };
  if (k.includes('fire') || key === '🔥') return { icon: 'flame', color: darkPalette.pending };
  if (k.includes('star') || key === '⭐') return { icon: 'star', color: darkPalette.pending };
  if (k.includes('clap') || key === '👏') return { icon: 'hand-left', color: darkPalette.live };
  if (k.includes('rocket') || key === '🚀') return { icon: 'rocket', color: darkPalette.primaryLight };
  return { icon: 'sparkles', color: darkPalette.accent };
}
