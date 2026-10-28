/**
 * The photographer's entry to hosting: "Go live" starts the quick flow, "My hosted events" lists them.
 * Renders nothing unless the server says this account can host, so with the feature off the app looks
 * exactly as it did, and a failed or slow answer never leaves a broken control behind.
 *
 * Both are Compact Glass action tiles (tinted fill, 1px border, solid icon tile, scale on press): Go live is
 * the live-red one, My hosted events the blue one with a count line.
 */
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ActionTile, TileRow } from '@/components/ui/Compact';
import { useAsync } from '@/hooks/useAsync';
import { useTheme } from '@/theme';
import { getHostingEligibility, listHostedEvents } from './api';
import { hostedCaption } from './hostFlow';

export function HostEntry() {
  const eligibility = useAsync(getHostingEligibility);
  if (!eligibility.data?.canHostFree) return null;
  return <HostTiles />;
}

/** Only mounted once the server has said this account can host, so the events are fetched for hosts alone. */
function HostTiles() {
  const { colors } = useTheme();
  const router = useRouter();
  const hosted = useAsync(listHostedEvents);
  const caption = useMemo(() => hostedCaption(hosted.data ?? undefined), [hosted.data]);
  const chevron = <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />;
  return (
    <TileRow>
      <ActionTile
        icon="radio-outline"
        tone="live"
        title="Go live"
        caption="Start"
        style={{ flex: 0.68 }}
        accessibilityLabel="Go live. Host your own event"
        onPress={() => router.push('/host/new' as Href)}
      />
      <ActionTile
        icon="albums-outline"
        tone="primary"
        title="My hosted events"
        caption={caption}
        badge={chevron}
        style={{ flex: 1.32 }}
        accessibilityLabel={`My hosted events. ${caption}`}
        onPress={() => router.push('/host' as Href)}
      />
    </TileRow>
  );
}
