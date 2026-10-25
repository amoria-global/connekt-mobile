import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LanguageSelectorSheet } from '@/components/LanguageSelectorSheet';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

/**
 * TopBar Language Button: A sleek, elevated chip matching the CurrencyButton.
 * Uses a globe map icon and active language code (EN, FR, ES) to open
 * the LanguageSelectorSheet from any screen.
 */
export function LanguageButton({ compact, inPill }: { compact?: boolean; inPill?: boolean } = {}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { language, t } = useLanguage();

  return (
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('languageSheetTitle')}: ${language.toUpperCase()}. ${t('selectLanguage')}`}
        style={({ pressed }) => [
          inPill ? styles.half : styles.chip,
          !inPill && compact && styles.chipCompact,
          pressed && styles.pressed,
        ]}
      >
        {inPill ? null : <Ionicons name="globe-outline" size={16} color={colors.primary} />}
        <Text style={[styles.code, inPill && styles.codePill]}>{language.toUpperCase()}</Text>
      </Pressable>

      <LanguageSelectorSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

const useStyles = makeStyles((c, e) => ({
  chip: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: spacing.xs + 4,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...e(2),
  },
  chipCompact: {
    height: 34,
    minWidth: 34,
    paddingHorizontal: spacing.xs + 2,
  },
  /** One half of the top bar's "RWF · EN" glass pill: the pill draws the glass, this is the target. */
  half: { minHeight: 44, minWidth: 36, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  codePill: { fontFamily: fonts.semibold, fontSize: 13, fontWeight: undefined, letterSpacing: 0.4 },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  code: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
    letterSpacing: 0.3,
  },
}));
