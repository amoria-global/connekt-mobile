import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { PhotographerEventsDashboard } from '@/features/events/PhotographerEventsDashboard';
import { OwnerEventsDashboard } from '@/features/events/OwnerEventsDashboard';

export default function EventsScreen() {
  const topBarHeight = useTopBarHeight();
  const { isPhotographer, isCoordinator, isViewer } = useRole();

  if (isPhotographer) {
    /*
     * Photographer "Events & albums" dashboard — full parity with
     * salo-run/app/pages/photographer/events.tsx: LIBRARY header, view
     * toggle (Events/Albums/Photobooks/Content), Total/Upcoming/Ongoing/
     * Completed stat strip, filter pills + search, and dark image-led
     * cards with per-status CTAs (Accept/Deny, Live Stream, Create Album,
     * Accepted chip, package badge) + the accept-booking sheet.
     */
    return (
      <Screen padded={false} edges={['bottom']}>
        <PhotographerEventsDashboard topInset={topBarHeight} />
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

  // Client & Event Coordinator — the same full owner dashboard (stats,
  // filters, search, image-led cards with Edit/Share + Manage). Its header
  // carries its own "New event" button, so no Fab. Passing `coordinator`
  // just switches the data source (listCoordinatorEvents vs listEvents) and
  // the eyebrow label.
  return (
    <Screen padded={false} edges={['bottom']}>
      <OwnerEventsDashboard coordinator={isCoordinator} topInset={topBarHeight} />
      <TopBar />
    </Screen>
  );
}
