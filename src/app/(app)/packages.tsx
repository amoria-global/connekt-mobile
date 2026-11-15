import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PrimaryButton, GhostButton } from '@/components/ui/Button';
import { HeaderHelpAndAdd } from '@/components/help/HeaderAddButton';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { deletePackage, listPackages, type Package, type ServiceType } from '@/features/packages/api';
import { filterBySession, splitBySession, topTierIds, type SessionFilter } from '@/features/packages/listModel';
import { PackageCard, PackageCardSkeleton } from '@/features/packages/PackageCard';
import {
  AddPackageSheet,
  DeleteConfirmSheet,
  PackageMenuSheet,
  ReplaceConfirmSheet,
} from '@/features/packages/PackageSheets';
import { useErrors } from '@/features/errors/useErrors';
import { useAsync } from '@/hooks/useAsync';
import { makeStyles, spacing } from '@/theme';
import { useLanguage } from '@/store/language';

type Sheet = null | 'add' | 'replace' | { kind: 'menu' | 'delete'; pkg: Package };

export default function PackagesScreen() {
  const { t } = useLanguage();
  const styles = useStyles();
  const router = useRouter();
  const { showError } = useErrors();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPackages(), []));
  const [filter, setFilter] = useState<SessionFilter>('ALL');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const { indoor, outdoor } = useMemo(() => splitBySession(all), [all]);
  const shown = useMemo(() => filterBySession(all, filter), [all, filter]);
  const topTiers = useMemo(() => topTierIds(all), [all]);

  const closeSheet = () => setSheet(null);

  const openBrochure = (replace: boolean) => {
    setSheet(null);
    router.push({ pathname: '/package/new', params: { mode: 'ai', replace: replace ? '1' : '0' } });
  };
  const openManual = (serviceType?: ServiceType) => {
    setSheet(null);
    router.push({ pathname: '/package/new', params: { mode: 'manual', ...(serviceType ? { serviceType } : {}) } });
  };
  const openEdit = (p: Package) => {
    setSheet(null);
    router.push({ pathname: '/package/new', params: { mode: 'manual', editId: p.id, data: JSON.stringify(p) } });
  };

  const doDelete = async (p: Package) => {
    setBusyId(p.id);
    try {
      await deletePackage(p.id);
      setSheet(null);
      await refresh();
    } catch (e) {
      // The package stays in the list. Close this sheet first so the error sheet is the only one open.
      setSheet(null);
      showError(e, { intent: 'destructive' }, { onRetry: () => void doDelete(p), where: 'packages.delete' });
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.buttons}>
        <View style={styles.buttonCell}>
          <PrimaryButton title={t('b2_pkgl_new')} onPress={() => setSheet('add')} />
        </View>
        <View style={styles.buttonCell}>
          <GhostButton title={t('b2_pkgl_upload')} onPress={() => openBrochure(false)} />
        </View>
      </View>
      <Segmented<SessionFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'ALL', label: `${t('b2_pkgl_all')} ${all.length}` },
          { value: 'STUDIO', label: `${t('b2_pkgl_indoor')} ${indoor.length}` },
          { value: 'OUTDOOR', label: `${t('b2_pkgl_outdoor')} ${outdoor.length}` },
        ]}
      />
    </View>
  );

  let body: React.ReactElement;
  if (loading && !data) {
    body = (
      <View style={styles.state}>
        {[0, 1, 2].map((i) => (
          <PackageCardSkeleton key={i} />
        ))}
      </View>
    );
  } else if (error && !data?.length) {
    body = (
      <View style={styles.state}>
        <ErrorState title={t('b2_pkgl_errTitle')} message={t('b2_pkgl_errMsg')} onRetry={refresh} />
      </View>
    );
  } else if (all.length === 0) {
    body = (
      <View style={styles.state}>
        <EmptyState
          icon="layers-outline"
          title={t('b2_packagesEmptyTitle')}
          message={t('b2_pkgl_emptyMsg')}
          action={{ label: t('b2_pkgl_emptyAction'), onPress: () => setSheet('add'), raised: true }}
        />
      </View>
    );
  } else {
    body = (
      <DataList
        data={shown}
        loading={false}
        error={null}
        onRefresh={refresh}
        headerExtra={header}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PackageCard
            pkg={item}
            topTier={topTiers.has(item.id)}
            dimmed={busyId === item.id}
            onEdit={() => openEdit(item)}
            onGeo={() => router.push(`/event/geo-pricing?packageId=${item.id}` as never)}
            onMore={() => setSheet({ kind: 'menu', pkg: item })}
          />
        )}
        emptyIcon="layers-outline"
        emptyTitle={filter === 'STUDIO' ? t('b2_pkgl_noIndoor') : t('b2_pkgl_noOutdoor')}
        emptyMessage={t('b2_pkgl_noneInFilter')}
        emptyAction={{ label: t('b2_pkgl_emptyAction'), onPress: () => setSheet('add') }}
      />
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader duplicatesHeader title={t('b2_packagesTitle')} subtitle={t('b2_pkgl_subtitle')} />
      {body}

      {sheet === 'add' ? (
        <AddPackageSheet
          canReplace={all.length > 0}
          onManual={() => openManual(filter === 'STUDIO' ? 'STUDIO' : 'OUTDOOR')}
          onBrochure={() => openBrochure(false)}
          onReplace={() => setSheet('replace')}
          onClose={closeSheet}
        />
      ) : null}
      {sheet === 'replace' ? <ReplaceConfirmSheet count={all.length} onConfirm={() => openBrochure(true)} onClose={closeSheet} /> : null}
      {sheet && typeof sheet === 'object' && sheet.kind === 'menu' ? (
        <PackageMenuSheet
          pkg={sheet.pkg}
          onEdit={() => openEdit(sheet.pkg)}
          onDelete={() => setSheet({ kind: 'delete', pkg: sheet.pkg })}
          onClose={closeSheet}
        />
      ) : null}
      {sheet && typeof sheet === 'object' && sheet.kind === 'delete' ? (
        <DeleteConfirmSheet pkg={sheet.pkg} busy={busyId === sheet.pkg.id} onConfirm={() => doDelete(sheet.pkg)} onClose={closeSheet} />
      ) : null}

      <Stack.Screen options={{ headerRight: () => <HeaderHelpAndAdd label={t('b2_pkgl_emptyAction')} onPress={() => setSheet('add')} /> }} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  header: { gap: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  buttonCell: { flex: 1 },
  state: { padding: spacing.xl, gap: spacing.md },
}));
