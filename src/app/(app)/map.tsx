import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { DirectBookingMapView } from '@/features/photographers/DirectBookingMapView';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/theme';

export default function DirectBookingMapScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    search?: string;
    specialty?: string;
    radiusKm?: string;
  }>();

  const radiusKm = params.radiusKm ? Number(params.radiusKm) : 25;

  return (
    <Screen padded={false} edges={['top']}>
      <Stack.Screen
        options={{
          title: t('b2_mapTitle'),
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        <DirectBookingMapView
          initialSearch={params.search || ''}
          initialSpecialty={params.specialty || 'All'}
          initialRadiusKm={radiusKm}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
