import { Stack } from 'expo-router';

import { useLanguage } from '@/hooks/useLanguage';

/** First-launch flow: branded splash → 3 intro slides. */
export default function OnboardingLayout() {
  const { t } = useLanguage();
  return (
    <Stack
      initialRouteName="welcome"
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Stack.Screen name="terms" />
      <Stack.Screen name="splash" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
