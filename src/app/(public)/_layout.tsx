import { Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { fonts, useTheme } from '@/theme';
import { HELP_ROUTES, HeaderHelpButton } from '@/components/help/HeaderHelpButton';

/** Guest-accessible screens (no login required). */
export default function PublicLayout() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const fallback = status === 'authenticated' ? '/(tabs)' : '/login';

  const renderBackToLogin = (tintColor?: string) => (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))}
      hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingRight: 8 }}
      accessibilityRole="button"
      accessibilityLabel={status === 'authenticated' ? t('navBack') : t('backToSignIn')}
    >
      <Ionicons name="chevron-back" size={22} color={tintColor || colors.primary} />
      <Text style={{ color: tintColor || colors.primary, fontSize: 14, fontWeight: '700', marginLeft: -2 }}>
        {status === 'authenticated' ? t('navBack') : t('signInBtn')}
      </Text>
    </Pressable>
  );

  const renderBackOnly = (tintColor?: string) => (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))}
      hitSlop={12}
      style={({ pressed }) => [{
        padding: 6,
        marginLeft: -2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      }]}
      accessibilityRole="button"
      accessibilityLabel={t('navGoBack')}
    >
      <Ionicons name="chevron-back" size={24} color={tintColor || colors.primary} />
    </Pressable>
  );

  return (
    <>
      <Stack
        screenOptions={({ route }) => ({
          headerTintColor: colors.link,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text, fontFamily: fonts.display },
          // Help in the header; the Help pages themselves leave it out (they are where it leads).
          headerRight: HELP_ROUTES.includes(route.name.split('/')[0]) ? undefined : () => <HeaderHelpButton />,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerLeft: () => renderBackOnly(),
        })}
      >
        <Stack.Screen
          name="explore-events"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="event/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="scan/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="wish/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="workspace-invite/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="events/join" options={{ title: t('navJoinEvent') }} />
        <Stack.Screen name="events/pay" options={{ title: t('navPayment') }} />
        <Stack.Screen
          name="events/live-stream"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="donate"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="find-photos"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="browse-photos"
          options={{
            title: t('navBrowsePhotos'),
            headerLeft: () => renderBackToLogin(),
          }}
        />
        <Stack.Screen name="gallery" options={{ title: t('navGallery') }} />
        <Stack.Screen name="help-center/index" options={{ title: t('navHelpCenter') }} />
        <Stack.Screen name="help-center/booking" options={{ title: t('navBookingHelp') }} />
        <Stack.Screen name="help-center/my-account" options={{ title: t('navMyAccountHelp') }} />
        <Stack.Screen name="help-center/payment-methods" options={{ title: t('navPaymentMethods') }} />
        <Stack.Screen name="help-center/payment" options={{ title: t('navPaymentHelp') }} />
        <Stack.Screen name="help-center/security" options={{ title: t('navSecurityHelp') }} />
        <Stack.Screen name="help-center/technical-support" options={{ title: t('navTechnicalSupport') }} />
        <Stack.Screen name="contact_us" options={{ title: t('navContactUs') }} />
        <Stack.Screen name="feedback" options={{ title: t('navSendFeedback') }} />
        <Stack.Screen name="privacy-policy" options={{ title: t('navPrivacyPolicy') }} />
        <Stack.Screen name="terms-of-service" options={{ title: t('navTermsConditions') }} />
        <Stack.Screen name="about" options={{ title: t('navAbout') }} />
        <Stack.Screen name="trust-safety" options={{ title: t('navTrustSafety') }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
