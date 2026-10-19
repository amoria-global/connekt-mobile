import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerType } from '@/features/auth/types';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { GlassSurface, glassScrim, glassTile, sheetGlassRadius, useGlassEdge } from '@/components/ui/GlassCard';

type RoleInfo = {
  role: CustomerType;
  title: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
};

interface ChooseRoleBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectRole: (role: CustomerType) => void;
  initialRole?: CustomerType | null;
}

export function ChooseRoleBottomSheet({
  visible,
  onClose,
  onSelectRole,
  initialRole = null,
}: ChooseRoleBottomSheetProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const glassEdge = useGlassEdge();
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();
  const [selected, setSelected] = useState<CustomerType | null>(initialRole);

  const roles = useMemo<RoleInfo[]>(() => [
    {
      role: 'Client',
      title: t('roleClientTitle'),
      blurb: t('roleClientBlurb'),
      icon: 'person-outline',
    },
    {
      role: 'Photographer',
      title: t('rolePhotographerTitle'),
      blurb: t('rolePhotographerBlurb'),
      icon: 'camera-outline',
    },
    {
      role: 'Coordinator',
      title: t('roleCoordinatorTitle'),
      blurb: t('roleCoordinatorBlurb'),
      icon: 'calendar-outline',
    },
  ], [language, t]);

  const animFade = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(400)).current;

  // Track if sheet is mounted internally to allow closing animation before modal unmounts
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setSelected(initialRole);
      Animated.parallel([
        Animated.timing(animFade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(animY, {
          toValue: 0,
          tension: 70,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isMounted) {
      animateClose(() => setIsMounted(false));
    }
  }, [visible]);

  const animateClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(animFade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(animY, {
        toValue: 420,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback?.();
    });
  };

  const handleDismiss = () => {
    animateClose(() => {
      setIsMounted(false);
      onClose();
    });
  };

  const handleContinue = () => {
    if (!selected) return;
    animateClose(() => {
      setIsMounted(false);
      onSelectRole(selected);
    });
  };

  // Drag down to dismiss gesture on handle & header
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          animY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.8) {
          handleDismiss();
        } else {
          Animated.spring(animY, {
            toValue: 0,
            tension: 75,
            friction: 11,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!isMounted) return null;

  return (
    <Modal
      transparent
      visible={isMounted}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Dimmed backdrop with blur */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: animFade }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 25 : 40}
            tint={isDark ? 'dark' : 'regular'}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close role selection"
          />
        </Animated.View>

        {/* Bottom sheet card */}
        <Animated.View
          style={[
            styles.sheet,
            glassEdge,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
              transform: [{ translateY: animY }],
            },
          ]}
        >
          <GlassSurface detached strength="thick" style={sheetGlassRadius(28)} />
          {/* Draggable handle area */}
          <View {...panResponder.panHandlers} style={styles.dragArea}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                {t('roleSheetTitle')}
              </Text>
              <Text style={styles.subtitle}>
                {t('roleSheetSubtitle')}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {roles.map((r: RoleInfo) => {
              const active = selected === r.role;
              return (
                <Pressable
                  key={r.role}
                  onPress={() => setSelected(r.role)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${r.title}. ${r.blurb}`}
                  style={({ pressed }) => [
                    styles.card,
                    active && styles.cardActive,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                    <Ionicons
                      name={r.icon}
                      size={22}
                      color={active ? colors.textOnPrimary : colors.primary}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
                      {r.title}
                    </Text>
                    <Text style={styles.cardBlurb}>{r.blurb}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={active ? colors.primary : colors.border}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleContinue}
              disabled={!selected}
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected }}
              accessibilityHint={selected ? undefined : 'Choose how you will use Connekyt first'}
              style={({ pressed }) => [
                styles.cta,
                !selected && styles.ctaDisabled,
                pressed && selected && styles.ctaPressed,
              ]}
            >
              <Text style={styles.ctaText}>{t('continueBtn')}</Text>
            </Pressable>

            <Pressable onPress={handleDismiss} hitSlop={8} style={styles.signInLine}>
              <Text style={styles.signInText}>
                {t('alreadyHaveAccount')}{' '}
                <Text style={styles.signInLink}>{t('signInBtn')}</Text>
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    backgroundColor: glassScrim(c),
  },
  sheet: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    maxHeight: '90%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.border,
    ...e(4),
  },
  dragArea: {
    paddingTop: spacing.xs,
    alignItems: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: c.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
  },
  scroll: {
    flexGrow: 0,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    ...glassTile(c),
  },
  cardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  cardPressed: {
    opacity: 0.9,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.tint,
  },
  iconWrapActive: {
    backgroundColor: c.primary,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  cardTitleActive: {
    color: c.primary,
  },
  cardBlurb: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 16,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  cta: {
    height: 50,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.textOnPrimary,
  },
  signInLine: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  signInText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  signInLink: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
}));
