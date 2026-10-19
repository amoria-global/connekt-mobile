import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { PersistentBottomBar } from '@/components/PersistentBottomBar';
import { useLanguage } from '@/store/language';

export default function AppTabsLayout() {
  const { language, t } = useLanguage();

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
        <Tabs.Screen name="index" options={{ title: t('tabHome') }} />
        <Tabs.Screen name="events" options={{ title: t('tabEvents') }} />
        <Tabs.Screen name="wallet" options={{ title: t('tabWallet') }} />
        <Tabs.Screen name="inbox" options={{ title: t('tabInbox') }} />
        <Tabs.Screen name="profile" options={{ title: t('tabProfile'), href: null }} />
        <Tabs.Screen name="more" options={{ title: t('tabMore') }} />
      </Tabs>

      <PersistentBottomBar />
    </View>
  );
}
