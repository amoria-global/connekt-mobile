import React, { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, GhostButton } from '@/components/ui/Button';
import { glassTile } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { Sheet } from '@/components/ui/Sheet';
import { StatusChip } from '@/components/ui/StatusChip';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { useLanguage } from '@/store/language';
import { tp } from '@/i18n/plural';
import type { Package } from './api';

type Tone = 'primary' | 'pending' | 'error';

function SheetRow({
  icon,
  tone = 'primary',
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <IconTile icon={icon} tone={tone} />
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, tone === 'error' && styles.rowTitleError]}>{title}</Text>
          {badge}
        </View>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** "Add a package": create manually (recommended), upload a brochure, or replace everything from a brochure. */
export function AddPackageSheet({
  canReplace,
  onManual,
  onBrochure,
  onReplace,
  onClose,
}: {
  canReplace: boolean;
  onManual: () => void;
  onBrochure: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { t } = useLanguage();
  return (
    <Sheet title={t('b2_pkgl_addTitle')} subtitle={t('b2_pkgl_addSub')} onClose={onClose}>
      <View style={styles.list}>
        <SheetRow
          icon="create-outline"
          title={t('b2_pkgl_manual')}
          subtitle={t('b2_pkgl_manualSub')}
          badge={<StatusChip label={t('b2_pkgl_recommended')} tone="primary" compact />}
          onPress={onManual}
        />
        <SheetRow icon="cloud-upload-outline" title={t('b2_pkgl_upload')} subtitle={t('b2_pkgl_brochureSub')} onPress={onBrochure} />
        {canReplace ? (
          <SheetRow icon="swap-horizontal-outline" tone="pending" title={t('b2_pkgl_replace')} subtitle={t('b2_pkgl_replaceSub')} onPress={onReplace} />
        ) : null}
        <GhostButton title={t('b2_packagesCancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** Before a replace-all starts. The server deletes each old package once the new ones are published. */
export function ReplaceConfirmSheet({ count, onConfirm, onClose }: { count: number; onConfirm: () => void; onClose: () => void }) {
  const styles = useStyles();
  const { t } = useLanguage();
  return (
    <Sheet title={t('b2_pkgl_replaceTitle')} onClose={onClose}>
      <View style={styles.list}>
        <Text style={styles.body}>{tp(t as never, 'b2_pkgl_replaceBody', count)}</Text>
        <Button title={t('b2_pkgl_replaceConfirm')} variant="primary" onPress={onConfirm} />
        <GhostButton title={t('b2_packagesCancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** The ⋯ menu. Delete lives only here. */
export function PackageMenuSheet({ pkg, onEdit, onDelete, onClose }: { pkg: Package; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  const styles = useStyles();
  const { t } = useLanguage();
  return (
    <Sheet title={pkg.name} onClose={onClose}>
      <View style={styles.list}>
        <SheetRow icon="create-outline" title={t('b2_pkgl_editDetails')} onPress={onEdit} />
        <SheetRow icon="trash-outline" tone="error" title={t('b2_packagesDelete')} onPress={onDelete} />
      </View>
    </Sheet>
  );
}

/** Names the package. A failure is shown by the caller (the error sheet, with Retry) and the package stays in the list. */
export function DeleteConfirmSheet({ pkg, busy, onConfirm, onClose }: { pkg: Package; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const styles = useStyles();
  const { t } = useLanguage();
  return (
    <Sheet title={t('b2_pkgl_deleteTitle', { name: pkg.name })} onClose={onClose} busy={busy}>
      <View style={styles.list}>
        <Text style={styles.body}>{t('b2_pkgl_deleteBody')}</Text>
        <Button title={t('b2_pkgl_deleteConfirm')} variant="danger" loading={busy} onPress={onConfirm} />
        <GhostButton title={t('b2_packagesCancel')} disabled={busy} onPress={onClose} />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.sm },
  body: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 21, color: c.textSoft },
  row: {
    ...glassTile(c),
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 56,
  },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowTitle: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: c.text },
  rowTitleError: { color: c.error },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.textMuted },
}));
