import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { PersistentBottomBar } from '@/components/PersistentBottomBar';

export default function AppTabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarHideOnKeyboard: Platform.OS === 'android',
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="events" options={{ title: 'Events' }} />
        <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
        <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', href: null }} />
        <Tabs.Screen name="more" options={{ title: 'More' }} />
      </Tabs>

      <PersistentBottomBar />
    </View>
  );
}
