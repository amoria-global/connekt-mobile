import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { PhotographerEventsDashboard } from '@/features/events/PhotographerEventsDashboard';
import { ClientEventsDashboard } from '@/features/events/ClientEventsDashboard';
import ExploreEventsScreen from '@/app/(public)/explore-events';
import { useLanguage } from '@/store/language';

export default function EventsScreen() {
  useLanguage((s) => s.language);
  const topBarHeight = useTopBarHeight();
  const insets = useSafeAreaInsets();
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
    // Midnight Glass (design/events.png): the screen's own large title replaces the shared top bar, so the first
    // screen is the schedule, not chrome. Currency, language and notifications stay on Home's top bar.
    return (
      <Screen padded={false} edges={[]}>
          <PhotographerEventsDashboard topInset={insets.top} />
      </Screen>
    );
  }

  if (isCoordinator) {
    return (
      <Screen padded={false} edges={[]}>
        <ClientEventsDashboard coordinator initialSearch={initialSearch} topInset={topBarHeight} />
        <TopBar />
      </Screen>
    );
  }

  /*
   * Client Events Dashboard:
   * Clients see all their created events, can find a photographer or explore
   * public events, and tap New to launch Direct Booking or Hybrid Matching
   * with live talent previews and ranked candidate dispatch.
   */
  return (
    <Screen padded={false} edges={[]}>
      <ClientEventsDashboard initialSearch={initialSearch} topInset={topBarHeight} />
      <TopBar />
    </Screen>
  );
}
