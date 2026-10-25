/**
 * Chat / reaction helpers shared by the studio components.
 * Moved verbatim from the previous control screen, behaviour unchanged.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { PublicStreamChat } from '@/features/streams/api';

import { darkPalette } from '@/theme';
export function getReactionIcon(key: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  const k = (key || '').toLowerCase();
  if (k === '❤️' || k.includes('heart') || k.includes('love')) {
    return { icon: 'heart', color: darkPalette.error };
  }
  if (k === '🔥' || k.includes('fire') || k.includes('flame')) {
    return { icon: 'flame', color: darkPalette.pending };
  }
  if (k === '🎁' || k.includes('gift')) {
    return { icon: 'gift', color: darkPalette.accent };
  }
  if (k === '⭐' || k === '🌟' || k.includes('star')) {
    return { icon: 'star', color: darkPalette.pending };
  }
  if (k === '👏' || k.includes('clap')) {
    return { icon: 'hand-left', color: darkPalette.live };
  }
  if (k === '👍' || k.includes('like') || k.includes('thumb')) {
    return { icon: 'thumbs-up', color: darkPalette.primaryLight };
  }
  return { icon: 'sparkles', color: darkPalette.accent };
}

/** Gifts are viewer-side; the host studio filters these chats out. */
export function isGiftChat(m: PublicStreamChat): boolean {
  return (m.chatType ?? m.type ?? '').toUpperCase() === 'GIFT';
}

export function chatSender(m: PublicStreamChat): string {
  return m.viewerName || m.senderName || 'Viewer';
}

/** Host messages are tagged "(Host)" locally or carry the creator's customer id. */
export function isHostChat(m: PublicStreamChat, hostCustomerId?: string | number | null): boolean {
  return !!(
    m.viewerName?.includes('(Host)') ||
    m.senderName?.includes('(Host)') ||
    (hostCustomerId && String(m.senderId) === String(hostCustomerId))
  );
}
