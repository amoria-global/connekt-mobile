import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { PhotographerEventsDashboard } from '@/features/events/PhotographerEventsDashboard';
import { OwnerEventsDashboard } from '@/features/events/OwnerEventsDashboard';
import ExploreEventsScreen from '@/app/(public)/explore-events';
import { useLanguage } from '@/store/language';

export default function EventsScreen() {
  useLanguage((s) => s.language);
  const topBarHeight = useTopBarHeight();
  const { isPhotographer, isCoordinator } = useRole();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const initialSearch = (params.q || params.category || '').trim();

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
      <Screen padded={false} edges={[]}>
        <PhotographerEventsDashboard topInset={topBarHeight} />
        <TopBar />
      </Screen>
    );
  }

  if (isCoordinator) {
    return (
      <Screen padded={false} edges={[]}>
        <OwnerEventsDashboard coordinator initialSearch={initialSearch} topInset={topBarHeight} />
        <TopBar />
      </Screen>
    );
  }

  /*
   * Client Events Dashboard:
   * Clients can see all their created events, browse public streams or vetted
   * photographers via workspace tabs, and tap "+" to launch Direct Booking
   * or Hybrid Matching with live talent previews and ranked candidate dispatch.
   */
  return (
    <Screen padded={false} edges={[]}>
      <OwnerEventsDashboard coordinator={false} initialSearch={initialSearch} topInset={topBarHeight} />
      <TopBar />
    </Screen>
  );
}
