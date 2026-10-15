/**
 * Placeholder route for the "More" tab.
 *
 * The bottom bar intercepts taps on this tab via `listeners.tabPress` and
 * opens a bottom-sheet modal instead of navigating here, so this screen
 * is never actually rendered. It only exists so expo-router has a
 * registered route for the tab button.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export default function MoreScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return <View />;
}
