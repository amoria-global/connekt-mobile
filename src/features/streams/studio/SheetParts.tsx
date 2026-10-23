import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts } from '@/theme';
import { S } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  const { tr } = useSharedT();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {tr(title)}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

type RowProps = {
  icon: IconName;
  label: string;
  /** Right-aligned current value. */
  value?: string;
  onPress?: () => void;
  /** Renders a toggle instead of a chevron. */
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  destructive?: boolean;
  disabled?: boolean;
  last?: boolean;
  hint?: string;
};

function SheetRowBase({ icon, label, value, onPress, toggle, destructive, disabled, last, hint }: RowProps) {
  const { tr } = useSharedT();
  const body = (
    <View style={[styles.row, !last && styles.rowDivider, disabled && styles.rowDisabled]}>
      <View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={destructive ? '#FCA5A5' : S.text} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDanger]} numberOfLines={1}>
          {tr(label)}
        </Text>
        {hint ? (
          <Text style={styles.rowHint} numberOfLines={2}>
            {tr(hint)}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {tr(value)}
        </Text>
      ) : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={disabled}
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: S.go }}
          thumbColor="#fff"
          accessibilityLabel={label}
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={S.textFaint} />
      ) : null}
    </View>
  );

  if (toggle || !onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled }}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
    >
      {body}
    </Pressable>
  );
}

export const SheetRow = memo(SheetRowBase);

const styles = StyleSheet.create({
  section: { marginBottom: 10 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: S.textFaint,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionBody: { backgroundColor: S.sheetRow, borderRadius: 14, overflow: 'hidden' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: S.sheetLine },
  rowDisabled: { opacity: 0.45 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowIconDanger: { backgroundColor: 'rgba(127,29,29,0.5)' },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.bold, fontSize: 17, color: S.text },
  rowLabelDanger: { color: '#FCA5A5' },
  rowHint: { fontFamily: fonts.regular, fontSize: 13, color: S.textFaint, marginTop: 1 },
  rowValue: { fontFamily: fonts.regular, fontSize: 15, color: S.textDim, maxWidth: '45%' },
});
