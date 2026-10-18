import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

import { useLanguage } from '@/hooks/useLanguage';

export default function AuthLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  // Explicit canvas: auth screens that do not paint their own background
  // would otherwise sit on React Navigation's default white.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
    </Stack>
  );
}
