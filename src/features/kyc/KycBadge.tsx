/**
 * KYC status badge — direct mobile port of salo-run/app/components/KycBadge.tsx.
 * Displays "KYC Verified" badge when status is APPROVED.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts, makeStyles, radii, useTheme } from '@/theme';

interface KycBadgeProps {
  kycStatus?: string | null;
  size?: 'sm' | 'md';
}

export function KycBadge({ kycStatus, size = 'sm' }: KycBadgeProps) {
  const { tr } = useSharedT();
  const styles = useStyles();
  const { colors } = useTheme();
  if (kycStatus !== 'APPROVED') return null;

  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, isSm ? styles.smPad : styles.mdPad]}>
      <Ionicons name="shield-checkmark" size={isSm ? 12 : 14} color={colors.success} />
      <Text style={[styles.text, isSm ? styles.smText : styles.mdText]}>
        {tr('KYC Verified')}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.full,
    backgroundColor: c.successBg,
    borderWidth: 1,
    borderColor: c.success,
    alignSelf: 'center',
  },
  smPad: { paddingHorizontal: 9, paddingVertical: 3 },
  mdPad: { paddingHorizontal: 12, paddingVertical: 5 },
  text: {
    fontFamily: fonts.bold,
    color: c.success,
    letterSpacing: 0.2,
  },
  smText: { fontSize: 11 },
  mdText: { fontSize: 13 },
}));
