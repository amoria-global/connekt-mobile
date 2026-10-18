import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
  useLanguage,
} from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { GlassSurface, glassScrim, glassTile, sheetGlassRadius, useGlassEdge } from '@/components/ui/GlassCard';

interface LanguageSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSelectorSheet({
  visible,
  onClose,
}: LanguageSelectorSheetProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const glassEdge = useGlassEdge();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
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
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close language selector"
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 30 : 50}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        {/* Sheet Content */}
        <View
          style={[
            styles.sheet,
            glassEdge,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md },
          ]}
        >
          <GlassSurface detached strength="thick" style={sheetGlassRadius(28)} />
          {/* Top Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('languageSheetTitle')}</Text>
              <Text style={styles.subtitle}>{t('languageSheetSubtitle')}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Close language selector"
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Language Options */}
          <View style={styles.list}>
            {SUPPORTED_LANGUAGES.map((item) => {
              const isSelected = item.code === language;
              return (
                <Pressable
                  key={item.code}
                  onPress={() => handleSelect(item.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${item.nativeLabel}, ${item.label}`}
                  style={({ pressed }) => [
                    styles.item,
                    isSelected && styles.itemSelected,
                    pressed && styles.itemPressed,
                  ]}
                >
                  <View style={styles.itemLeft}>
                    <View
                      style={[
                        styles.globeIconWrap,
                        isSelected && styles.globeIconWrapSelected,
                      ]}
                    >
                      <Ionicons
                        name="globe-outline"
                        size={18}
                        color={isSelected ? colors.accent : colors.primary}
                      />
                    </View>
                    <View style={styles.itemTextWrap}>
                      <Text
                        style={[
                          styles.nativeName,
                          isSelected && styles.nativeNameSelected,
                        ]}
                      >
                        {item.nativeLabel}
                      </Text>
                      <Text style={styles.label}>{item.label}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.checkCircle,
                      isSelected && styles.checkCircleSelected,
                    ]}
                  >
                    {isSelected ? (
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
          </View>
        </View>
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
    backgroundColor: glassScrim(c),
  },
  sheet: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: spacing.xl,
    zIndex: 10,
    elevation: 10,
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
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: c.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
    color: c.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  list: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    ...glassTile(c),
  },
  itemSelected: {
    borderColor: c.accent,
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
  },
  itemPressed: {
    opacity: 0.8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  globeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeIconWrapSelected: {
    backgroundColor: 'rgba(242, 12, 143, 0.12)',
    borderColor: 'rgba(242, 12, 143, 0.35)',
  },
  itemTextWrap: {
    gap: 1,
  },
  nativeName: {
    fontSize: fontSize.md,
    fontFamily: fonts.bold,
    fontWeight: '600',
    color: c.text,
  },
  nativeNameSelected: {
    color: c.accent,
  },
  label: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
    color: c.textMuted,
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
    borderColor: c.accent,
    backgroundColor: c.accent,
  },
}));
