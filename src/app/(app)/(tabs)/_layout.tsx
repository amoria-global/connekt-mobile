import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight } from '@/theme';

function CustomTabBar({ state, descriptors, navigation, insets }: any) {
  return (
    <View style={[styles.tabBarContainer, { bottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
      {/* Background layer */}
      <View style={[StyleSheet.absoluteFillObject, styles.bgClip]}>
        {Platform.OS === 'android' ? (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.primary }]} />
        ) : (
          <>
            <BlurView tint="light" intensity={32} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,58,133,0.5)' }]} />
          </>
        )}
      </View>

      {/* Tabs row */}
      <View style={styles.tabContent}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Determine icon name based on route
          let iconName: any = 'home-outline';
          if (route.name === 'index') iconName = isFocused ? 'home' : 'home-outline';
          if (route.name === 'events') iconName = isFocused ? 'calendar' : 'calendar-outline';
          if (route.name === 'wallet') iconName = isFocused ? 'wallet' : 'wallet-outline';
          if (route.name === 'inbox') iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline';
          if (route.name === 'profile') iconName = isFocused ? 'person' : 'person-outline';

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
            >
              <View style={[styles.iconWrapper, isFocused && styles.iconWrapperFocused]}>
                <Ionicons name={iconName} size={22} color={isFocused ? '#ffffff' : 'rgba(255,255,255,0.6)'} />
                <Text style={[styles.tabLabel, { color: isFocused ? '#ffffff' : 'rgba(255,255,255,0.6)' }]}>
                  {String(label).toUpperCase()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AppTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} insets={insets} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: Platform.OS === 'android',
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  bgClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tint: { backgroundColor: 'rgba(0,0,0,0.4)' },
  tabContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    width: 66,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrapperFocused: {
    backgroundColor: colors.accent,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
});
