import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { EventsList } from '@/features/events/EventsList';

export default function EventsScreen() {
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const { isPhotographer, isCoordinator, isViewer, ownsEvents } = useRole();

  if (isPhotographer) {
    /*
     * Web parity: salo-run's photographer/events tab carries the union
     * of bookings + assigned events in a single feed. Pending booking
     * requests are surfaced INLINE on each event card (Accept / Decline
     * pills below the meta strip) — there is no separate Bookings tab
     * on the web, and the previous two-tab toggle here was redundant
     * with the per-card CTAs.
     */
    return (
      <Screen padded={false} edges={['bottom']}>
        <EventsList variant="photographer" topInset={topBarHeight} />
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
