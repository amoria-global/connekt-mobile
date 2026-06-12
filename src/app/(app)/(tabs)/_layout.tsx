import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '@/theme';

const PILL_RADIUS = radii.full;

/**
 * Frosted brand-blue background, clipped to the floating pill shape.
 * iOS gets a true blur; Android uses a deterministic solid brand-blue fill
 * (predictable on every device — no experimental blur jank).
 */
function TabBarBackground() {
  if (Platform.OS === 'android') {
    return <View style={[styles.bgClip, styles.androidFill]} />;
  }
  return (
    <View style={styles.bgClip}>
      <BlurView tint="light" intensity={32} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
    </View>
  );
}

export default function AppTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Active icon/label use the "Welcome to Connekyt" pink; inactive is soft white.
        tabBarActiveTintColor: colors.accentLight,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.75)',
        tabBarBackground: () => <TabBarBackground />,
        // Floating rounded pill, lifted above the home indicator.
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom > 0 ? insets.bottom : 12,
          height: 64,
          borderRadius: PILL_RADIUS,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          paddingTop: 8,
          paddingBottom: 8,
          // soft brand-blue float shadow (iOS) + elevation (Android)
          shadowColor: colors.primary,
          shadowOpacity: 0.22,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
        tabBarItemStyle: { borderRadius: PILL_RADIUS },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // Keep scrollable content from hiding behind the floating bar.
        tabBarHideOnKeyboard: Platform.OS === 'android',
        sceneStyle: { paddingBottom: 64 + (insets.bottom > 0 ? insets.bottom : 12) + 16 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bgClip: { ...StyleSheet.absoluteFillObject, borderRadius: PILL_RADIUS, overflow: 'hidden' },
  tint: { backgroundColor: 'rgba(8,58,133,0.55)' },
});
