/**
 * Country chooser shared by the payment picker and the add-account sheet.
 *
 * On iOS it opens as a page sheet, so it sits below the status bar and a downward
 * swipe also closes it. On Android it is full screen below the status bar. The
 * header has a labelled Close button with a 44pt target, and there is a second
 * Close at the bottom so the way out is never hidden behind a search keyboard.
 */
import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flagEmoji } from '@/components/ui/PhoneInput';
import { PAYMENT_COUNTRY_LIST } from '@/features/payments/countries';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

type Props = {
  visible: boolean;
  /** Currently chosen ISO 3166-1 alpha-2 code, if any. */
  selected?: string | null;
  onClose: () => void;
  onSelect: (iso2: string) => void;
};

export function CountrySelectModal({ visible, selected, onClose, onSelect }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const isIos = Platform.OS === 'ios';

  const countries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAYMENT_COUNTRY_LIST;
    return PAYMENT_COUNTRY_LIST.filter(
      (c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q || c.dial.includes(q.replace(/^\+/, '')),
    );
  }, [query]);

  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (iso2: string) => {
    setQuery('');
    onSelect(iso2);
  };
  const active = (selected || '').toUpperCase();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={isIos ? 'pageSheet' : 'fullScreen'}
      onRequestClose={close}
    >
      {/* A page sheet already clears the status bar; full screen needs the inset. */}
      <View style={[styles.modal, { paddingTop: isIos ? 0 : insets.top }]}>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">Select country</Text>
          <Pressable
            onPress={close}
            style={styles.closeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close country list"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search country or dial code"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={countries}
          keyExtractor={(c) => c.iso2}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No matching country.</Text>}
          renderItem={({ item }) => {
            const on = item.iso2 === active;
            return (
              <Pressable
                style={[styles.row, on && styles.rowActive]}
                onPress={() => pick(item.iso2)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${item.name}, plus ${item.dial}`}
              >
                <Text style={styles.flag}>{flagEmoji(item.iso2)}</Text>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.dial}>+{item.dial}</Text>
                {on ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
        />
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            onPress={close}
            style={styles.footerBtn}
            accessibilityRole="button"
            accessibilityLabel="Close country list"
          >
            <Text style={styles.footerText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  modal: { flex: 1, backgroundColor: c.surface },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  searchInput: { flex: 1, color: c.text, fontSize: fontSize.sm, minHeight: 44 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  rowActive: { backgroundColor: c.tint },
  flag: { fontSize: 20 },
  rowName: { flex: 1, color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  dial: { color: c.textMuted, fontSize: fontSize.sm },
  empty: { color: c.textMuted, textAlign: 'center', padding: spacing.xl },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  footerBtn: {
    minHeight: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  footerText: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
}));
