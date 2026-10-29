/**
 * The shape every sign-in screen shares: a photograph across the top and a
 * frosted glass sheet rising over the rest. Login set the pattern; signup,
 * forgot password and the code screens use the same frame so moving between
 * them feels like one place.
 *
 *   ┌──────────────────────┐
 *   │ ‹ / logo        EN ▾ │  photo band (always light-on-photo)
 *   │      [bandFooter]    │
 *   ├──────────────────────┤
 *   │ Title                │  glass sheet (follows the theme)
 *   │ Subtitle             │
 *   │ children…            │
 *   └──────────────────────┘
 */
import { useRouter, type Href } from 'expo-router';
import { HELP_HREF } from '@/components/help/GlobalHelpButton';
import { useState, type ReactNode, type Ref } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSelectorSheet } from '@/components/LanguageSelectorSheet';
import { Screen } from '@/components/ui/Screen';
import {
  GlassLayer,
  GlassScene,
  GlassSurface,
  glassClear,
  useGlassEdge,
} from '@/components/ui/GlassCard';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing, onFill } from '@/theme';

import { AUTH_BACKDROP } from './backdrop';

const SHEET_RADIUS = 32;

type Props = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Shows a back button in place of the logo. */
  onBack?: () => void;
  /** Share of the screen height the photo keeps above the sheet. */
  bandRatio?: number;
  /** Content pinned to the bottom of the photo band (login's guest paths). */
  bandFooter?: ReactNode;
  /** Small element above the title, e.g. a role chip or a step indicator. */
  eyebrow?: ReactNode;
  /** Center the heading (confirmation states) instead of aligning it left. */
  centered?: boolean;
  /** Smaller title and tighter spacing in the sheet, so the photo band can keep 40% of the height. */
  compact?: boolean;
  /** Closes the sheet, pushed to its bottom edge (login's "Create an account"). */
  footer?: ReactNode;
  scrollRef?: Ref<ScrollView>;
};

export function AuthGlassLayout({
  title,
  subtitle,
  children,
  onBack,
  bandRatio = 0.3,
  bandFooter,
  eyebrow,
  centered = false,
  compact = false,
  footer,
  scrollRef,
}: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const glassEdge = useGlassEdge();

  return (
    <Screen padded={false} edges={[]} glow={false}>
      {/* The band is always a photo, so its chrome is always light. */}
      <StatusBar style="light" />
      <GlassScene image={AUTH_BACKDROP} bleedTop={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View
              style={[
                styles.band,
                { minHeight: Math.round(height * bandRatio), paddingTop: insets.top + spacing.sm },
              ]}
            >
              <View style={styles.bandBar}>
                {onBack ? (
                  <Pressable
                    onPress={onBack}
                    hitSlop={8}
                    style={({ pressed }) => [styles.roundBtn, glassClear, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                  >
                    <GlassLayer fill="rgba(0,0,0,0.22)" />
                    <Ionicons name="chevron-back" size={22} color={onFill} />
                  </Pressable>
                ) : (
                  <Image
                    source={require('../../../assets/images/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                )}
                <View style={styles.bandActions}>
                  <PhotoHelpPill />
                  <PhotoLanguagePill />
                </View>
              </View>
              {bandFooter ? <View style={styles.bandFooter}>{bandFooter}</View> : null}
            </View>

            <View
              style={[
                styles.sheet,
                compact && styles.sheetCompact,
                glassEdge,
                { paddingBottom: insets.bottom + (compact ? spacing.md : spacing.lg) },
              ]}
            >
              <GlassSurface strength="thick" style={styles.sheetGlass} />
              <View style={[styles.heading, centered && styles.headingCentered]}>
                {eyebrow}
                <Text
                  style={[styles.title, compact && styles.titleCompact, centered && styles.textCenter]}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, compact && styles.subtitleCompact, centered && styles.textCenter]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {children}
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </GlassScene>
    </Screen>
  );
}

/**
 * Help for chrome that sits on a photo: the same dark glass as the language pill. It replaces the floating
 * Help button on the sign-in screens, where that one sat over the invitation link (helpButtonLayout).
 */
export function PhotoHelpPill() {
  const styles = useStyles();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(HELP_HREF as Href)}
      hitSlop={8}
      style={({ pressed }) => [styles.photoPill, styles.photoPillRound, glassClear, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Help"
    >
      <GlassLayer fill="rgba(0,0,0,0.22)" />
      <Ionicons name="help-circle-outline" size={18} color={onFill} />
    </Pressable>
  );
}

/**
 * Language switch for chrome that sits on a photo: dark glass, white type, in
 * both schemes. Opens the language sheet itself.
 */
export function PhotoLanguagePill() {
  const styles = useStyles();
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.photoPill, glassClear, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('languageSheetTitle')}: ${language.toUpperCase()}`}
      >
        <GlassLayer fill="rgba(0,0,0,0.22)" />
        <Ionicons name="globe-outline" size={15} color={onFill} />
        <Text style={styles.photoPillText}>{language.toUpperCase()}</Text>
        <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.8)" />
      </Pressable>
      <LanguageSelectorSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  bandActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photoPillRound: { width: 40, paddingHorizontal: 0, justifyContent: 'center' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  pressed: { opacity: 0.7 },

  band: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  bandBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bandFooter: { marginTop: spacing.lg },
  logo: { width: 40, height: 40 },
  // Android has no blur here, so the chips keep a plain smoked fill.
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  photoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  photoPillText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    fontWeight: fontWeight.bold,
    color: c.textOnPrimary,
    letterSpacing: 0.6,
  },

  sheet: {
    flexGrow: 1,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + spacing.xs,
    gap: spacing.lg,
  },
  // Tighter sheet for screens that must leave the photo band at least 40% of the height.
  sheetCompact: { paddingTop: spacing.md, gap: spacing.sm },
  titleCompact: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  subtitleCompact: { fontSize: fontSize.sm, lineHeight: 18 },
  // Takes the sheet's spare height, so the footer rests on the bottom edge.
  footer: { flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheetGlass: { borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS },
  heading: { gap: 6 },
  headingCentered: { alignItems: 'center' },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: fontSize.md, lineHeight: 22, color: c.textSoft },
  textCenter: { textAlign: 'center' },
}));

/** Shared link style for the sheet's secondary actions ("Back to sign in"). */
export const useAuthLinkStyles = makeStyles((c) => ({
  linkRow: { alignSelf: 'center', paddingVertical: spacing.xs },
  linkMuted: { color: c.textSoft, fontSize: fontSize.sm },
  link: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
}));
