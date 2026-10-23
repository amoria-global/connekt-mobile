import { useState } from 'react';

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyCode, useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { glassTile } from '@/components/ui/GlassCard';

const flagUri = (flag: string) => `https://flagcdn.com/w40/${flag}.png`;

interface CurrencySelectorSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CurrencySelectorSheet({
  visible,
  onClose,
}: CurrencySelectorSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const currency = useCurrency((s) => s.currency);
  const currencies = useCurrency((s) => s.currencies);
  const setCurrency = useCurrency((s) => s.setCurrency);

  const handleSelect = (code: CurrencyCode) => {
    setCurrency(code);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <GlassScrim onPress={onClose} style={StyleSheet.absoluteFill} accessibilityLabel="Close currency selector" />

        {/* Sheet Content */}
        <GlassSheetHost
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md },
          ]}
        >
          {/* Top Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('currencySectionTitle')}</Text>
              <Text style={styles.subtitle}>{t('currencySectionSubtitle')}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Currencies List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {currencies.map((c) => {
              const selected = c.code === currency;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => handleSelect(c.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${c.code}, ${c.name}`}
                  style={({ pressed }) => [
                    styles.row,
                    selected && styles.rowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Image
                    source={{ uri: flagUri(c.flag) }}
                    style={styles.rowFlag}
                    contentFit="cover"
                  />
                  <Text style={[styles.rowCode, selected && styles.rowCodeSelected]}>
                    {c.code}
                  </Text>
                  <Text
                    style={[styles.rowName, selected && styles.rowNameSelected]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  <View
                    style={[
                      styles.checkCircle,
                      selected && styles.checkCircleSelected,
                    ]}
                  >
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={colors.textOnPrimary}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </GlassSheetHost>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    paddingTop: 12,
    paddingHorizontal: spacing.xl,
    maxHeight: '75%',
    ...e(4),
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: radii.full,
    backgroundColor: c.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    ...glassTile(c),
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    ...glassTile(c),
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
  rowSelected: {
    borderColor: c.primary,
    backgroundColor: 'rgba(10, 102, 194, 0.08)',
  },
  rowFlag: {
    width: 26,
    height: 18,
    borderRadius: 3,
  },
  rowCode: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
    width: 44,
  },
  rowCodeSelected: {
    color: c.primary,
  },
  rowName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: c.textSoft,
  },
  rowNameSelected: {
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: c.primary,
    backgroundColor: c.primary,
  },
}));
