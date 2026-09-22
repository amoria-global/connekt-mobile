/**
 * KYC status badge — direct mobile port of salo-run/app/components/KycBadge.tsx.
 * Displays "KYC Verified" badge when status is APPROVED.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radii } from '@/theme';

interface KycBadgeProps {
  kycStatus?: string | null;
  size?: 'sm' | 'md';
}

export function KycBadge({ kycStatus, size = 'sm' }: KycBadgeProps) {
  if (kycStatus !== 'APPROVED') return null;

  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, isSm ? styles.smPad : styles.mdPad]}>
      <Ionicons name="shield-checkmark" size={isSm ? 12 : 14} color="#059669" />
      <Text style={[styles.text, isSm ? styles.smText : styles.mdText]}>
        KYC Verified
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignSelf: 'center',
  },
  smPad: { paddingHorizontal: 9, paddingVertical: 3 },
  mdPad: { paddingHorizontal: 12, paddingVertical: 5 },
  text: {
    fontFamily: fonts.bold,
    color: '#059669',
    letterSpacing: 0.2,
  },
  smText: { fontSize: 11 },
  mdText: { fontSize: 13 },
});
