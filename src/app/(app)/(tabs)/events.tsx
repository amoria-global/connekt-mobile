import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { BookingsList } from '@/features/bookings/BookingsList';
import { EventsList } from '@/features/events/EventsList';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function EventsScreen() {
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const { isPhotographer, isCoordinator, isViewer, ownsEvents } = useRole();
  const [photogTab, setPhotogTab] = useState<'events' | 'bookings'>('events');

  if (isPhotographer) {
    /*
     * Web parity: salo-run's photographer/events is a workspace with
     * four tabs (events / albums / photobooks / content). Albums,
     * photobooks and content live on their own mobile screens, so we
     * only split the photographer-tab into two: Events (assigned-to-me
     * feed with inline Create Album / Album Sent CTAs) and Bookings
     * (incoming pending requests).
     */
    return (
      <Screen padded={false} edges={['bottom']}>
        <View style={[styles.photogTabs, { marginTop: topBarHeight + spacing.md }]}>
          <Pressable
            onPress={() => setPhotogTab('events')}
            style={[styles.photogTab, photogTab === 'events' && styles.photogTabActive]}
          >
            <Text style={[styles.photogTabText, photogTab === 'events' && styles.photogTabTextActive]}>
              Events
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPhotogTab('bookings')}
            style={[styles.photogTab, photogTab === 'bookings' && styles.photogTabActive]}
          >
            <Text style={[styles.photogTabText, photogTab === 'bookings' && styles.photogTabTextActive]}>
              Bookings
            </Text>
          </Pressable>
        </View>
        {photogTab === 'events' ? (
          <EventsList variant="photographer" />
        ) : (
          <BookingsList title="Bookings" subtitle="Requests from clients" topInset={0} />
        )}
        <TopBar />
      </Screen>
    );
  }

  if (isViewer) {
    return (
      <Screen padded={false} edges={['bottom']}>
        <View style={{ flex: 1, paddingTop: topBarHeight }}>
          <EmptyState
            icon="videocam-outline"
            title="Discover live streams"
            message="As a viewer, head to Live Streams from the Home screen to watch and support creators."
          />
        </View>
        <TopBar />
      </Screen>
    );
  }

  // Client & Coordinator both own events.
  return (
    <Screen padded={false} edges={['bottom']}>
      <EventsList
        coordinator={isCoordinator}
        title="Events"
        subtitle="Your bookings and sessions"
        topInset={topBarHeight}
      />
      {ownsEvents ? <Fab icon="add" onPress={() => router.push('/event/new')} /> : null}
      <TopBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photogTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  photogTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.lg,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  photogTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  photogTabText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textSoft },
  photogTabTextActive: { color: colors.textOnPrimary },
});
