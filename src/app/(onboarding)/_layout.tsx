import { Stack } from 'expo-router';

/** First-launch flow: branded splash → 3 intro slides. */
export default function OnboardingLayout() {
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
