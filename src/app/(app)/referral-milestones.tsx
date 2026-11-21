import { Stack } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { MilestonesScreenContent } from '@/features/referral/MilestonesView';
import { useMilestoneCopy } from '@/features/referral/referral';

/** Grow your store: the milestone referral earnings screen (opened from the Home card and the congratulations sheet). */
export default function ReferralMilestonesScreen() {
  const m = useMilestoneCopy();
  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: m.growTitle }} />
      <MilestonesScreenContent />
    </Screen>
  );
}
