import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/components/ui/dialog';
import { DataList } from '@/components/ui/DataList';
import { HeaderHelpAndAdd } from '@/components/help/HeaderAddButton';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  deletePackage,
  listPackages,
  type Package,
  type ServiceType,
} from '@/features/packages/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme, onFill } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';

type SessionFilter = 'ALL' | ServiceType;

export default function PackagesScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPackages(), []));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('ALL');

  const allPackages = useMemo(() => data ?? [], [data]);
  const indoorPackages = useMemo(
    () =>
      allPackages
        .filter((p) => p.serviceType === 'STUDIO')
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    [allPackages],
  );
  const outdoorPackages = useMemo(
    () =>
      allPackages
        .filter((p) => p.serviceType !== 'STUDIO')
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    [allPackages],
  );

  const filteredPackages = useMemo(() => {
    if (sessionFilter === 'STUDIO') return indoorPackages;
    if (sessionFilter === 'OUTDOOR') return outdoorPackages;
    return [...indoorPackages, ...outdoorPackages];
  }, [sessionFilter, indoorPackages, outdoorPackages]);

  const onDelete = (p: Package) => {
    Alert.alert(t('b2_packagesDeleteTitle'), t('b2_packagesDeleteMessage', { name: p.name }), [
      { text: t('b2_packagesCancel'), style: 'cancel' },
      {
        text: t('b2_packagesDelete'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(p.id);
          try {
            await deletePackage(p.id);
            await refresh();
          } catch {
            Alert.alert(t('b2_packagesDeleteErrorTitle'), t('b2_packagesTryAgain'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const openAiUpload = (replaceExisting = false) => {
    router.push({
      pathname: '/package/new',
      params: { mode: 'ai', replace: replaceExisting ? '1' : '0' },
    });
  };

  const openManualCreate = (defaultSession?: ServiceType) => {
    router.push({
      pathname: '/package/new',
      params: {
        mode: 'manual',
        ...(defaultSession ? { serviceType: defaultSession } : {}),
      },
    });
  };

  const headerComponent = (
    <View style={styles.headerBlock}>
      {/* Action Cards (Step 2 in Connekyt AI Package Management Workflow) */}
      <View style={styles.actionCardsWrap}>
        {/* 1. Upload New Packages with AI (PDF / JPG / PNG) */}
        <Pressable
          onPress={() => openAiUpload(false)}
          style={({ pressed }) => [
            styles.actionCard,
            styles.actionCardPrimary,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Upload New Packages with AI"
        >
          <View style={styles.actionIconCirclePrimary}>
            <Ionicons name="sparkles" size={20} color={onFill} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.actionTitleRow}>
              <Text style={styles.actionTitlePrimary}>Upload Packages with AI</Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>GPT-5 LUNA · PDF / PHOTO</Text>
              </View>
            </View>
            <Text style={styles.actionSubtitlePrimary}>
              Upload your PDF brochure or menu photo. AI extracts Indoor & Outdoor packages, items, delivery policy & prices (Diamond, Gold, Silver, Premium, Basic).
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={onFill} />
        </Pressable>

        {/* 2. Update Packages (Replace Existing) + 3. Add Package Manually */}
        <View style={styles.secondaryActionsRow}>
          <Pressable
            onPress={() => openAiUpload(true)}
            style={({ pressed }) => [
              styles.secondaryActionCard,
              allPackages.length > 0 && styles.secondaryActionCardSuggested,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Update Packages (Replace Existing)"
          >
            <View style={styles.secondaryTopRow}>
              <View style={styles.secondaryIconBox}>
                <Ionicons name="sync-outline" size={17} color={colors.primary} />
              </View>
              {allPackages.length > 0 ? (
                <View style={styles.suggestedPill}>
                  <Text style={styles.suggestedPillText}>SUGGESTED</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.secondaryActionTitle}>Update Packages</Text>
            <Text style={styles.secondaryActionSub}>
              {allPackages.length > 0
                ? `Replace or compare your ${allPackages.length} online package(s)`
                : 'Upload new brochure to replace existing'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              openManualCreate(sessionFilter === 'STUDIO' ? 'STUDIO' : 'OUTDOOR')
            }
            style={({ pressed }) => [styles.secondaryActionCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add Package Manually"
          >
            <View style={styles.secondaryTopRow}>
              <View style={styles.secondaryIconBox}>
                <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
              </View>
              <View style={[styles.suggestedPill, { backgroundColor: colors.surface }]}>
                <Text style={[styles.suggestedPillText, { color: colors.textMuted }]}>CUSTOM</Text>
              </View>
            </View>
            <Text style={styles.secondaryActionTitle}>Add Manually</Text>
            <Text style={styles.secondaryActionSub}>
              Select tier title, add items into list & set pricing
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Session Category Filter Tabs: All / Indoor (Studio) / Outdoor (Events) */}
      <View style={styles.sessionTabsRow}>
        {(
          [
            ['ALL', 'layers-outline', `All (${allPackages.length})`],
            ['STUDIO', 'home-outline', `Indoor (${indoorPackages.length})`],
            ['OUTDOOR', 'sunny-outline', `Outdoor (${outdoorPackages.length})`],
          ] as [SessionFilter, keyof typeof Ionicons.glyphMap, string][]
        ).map(([key, icon, label]) => {
          const active = sessionFilter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSessionFilter(key)}
              style={[styles.sessionTab, active && styles.sessionTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={icon} size={14} color={active ? onFill : colors.primary} />
              <Text style={[styles.sessionTabText, active && styles.sessionTabTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen padded={false}>
      <ScreenHeader
        duplicatesHeader
        title={t('b2_packagesTitle')}
        subtitle="Manage your Indoor (Studio) and Outdoor photography packages with AI or manual setup."
      />
      <DataList
        data={filteredPackages}
        loading={loading}
        error={error}
        onRefresh={refresh}
        headerExtra={headerComponent}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => {
          const isStudio = item.serviceType === 'STUDIO';
          const isDiamond = item.name.toLowerCase().includes('diamond');
          const featureNames = (item.features ?? [])
            .filter((f) => f.isIncluded !== false)
            .map((f) => f.featureName);

          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                isDiamond && styles.cardDiamond,
                busyId === item.id && styles.dim,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/package/new',
                  params: { mode: 'manual', editId: item.id, data: JSON.stringify(item) },
                })
              }
            >
              <View style={styles.row}>
                <View style={styles.titleGroup}>
                  <View style={styles.tierTitleRow}>
                    <Ionicons
                      name={isDiamond ? 'diamond-outline' : 'pricetag-outline'}
                      size={16}
                      color={isDiamond ? colors.accent : colors.primary}
                    />
                    <Text style={styles.name}>{item.name}</Text>
                    {isDiamond ? (
                      <View style={styles.topTierBadge}>
                        <Text style={styles.topTierBadgeText}>TOP TIER</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.sessionBadge}>
                    <Ionicons
                      name={isStudio ? 'home-outline' : 'sunny-outline'}
                      size={11}
                      color={colors.primary}
                    />
                    <Text style={styles.sessionBadgeText}>
                      {isStudio ? 'Indoor (Studio session)' : 'Outdoor (Outside studio)'}
                    </Text>
                  </View>
                </View>

                {item.price != null ? (
                  <View style={styles.priceBadge}>
                    <Text style={styles.price}>{formatPrice(item.price, item.currency)}</Text>
                    {item.priceUnit ? (
                      <Text style={styles.priceUnitText}>{item.priceUnit}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}

              <View style={styles.metricsRow}>
                {item.durationHours ? (
                  <View style={styles.metricChip}>
                    <Ionicons name="time-outline" size={12} color={colors.primary} />
                    <Text style={styles.metricChipText}>{`${item.durationHours}h session`}</Text>
                  </View>
                ) : null}
                {item.includedPhotos ? (
                  <View style={styles.metricChip}>
                    <Ionicons name="images-outline" size={12} color={colors.primary} />
                    <Text style={styles.metricChipText}>
                      {t('b2_packagesPhotosCount', { count: item.includedPhotos })}
                    </Text>
                  </View>
                ) : null}
                {item.includedVideos ? (
                  <View style={styles.metricChip}>
                    <Ionicons name="videocam-outline" size={12} color={colors.primary} />
                    <Text style={styles.metricChipText}>
                      {t('b2_packagesVideosCount', { count: item.includedVideos })}
                    </Text>
                  </View>
                ) : null}
                {item.deliveryDays ? (
                  <View style={styles.metricChip}>
                    <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                    <Text style={styles.metricChipText}>{`Delivery in ${item.deliveryDays}d`}</Text>
                  </View>
                ) : null}
                {item.hasLiveStream ? (
                  <View style={styles.metricChip}>
                    <Ionicons name="radio-outline" size={12} color={colors.accent} />
                    <Text style={styles.metricChipText}>{t('b2_packagesLiveStream')}</Text>
                  </View>
                ) : null}
              </View>

              {featureNames.length > 0 ? (
                <View style={styles.ingredientsBox}>
                  {featureNames.slice(0, 4).map((feat, idx) => (
                    <Text key={`${feat}-${idx}`} style={styles.ingredientLine} numberOfLines={1}>
                      {`• ${feat}`}
                    </Text>
                  ))}
                  {featureNames.length > 4 ? (
                    <Text style={styles.moreIngredientsText}>
                      {`+${featureNames.length - 4} more item(s)`}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.cardActions}>
                <Text style={styles.editHint}>Edit Details</Text>
                <Text
                  style={styles.geoLink}
                  onPress={() => router.push(`/event/geo-pricing?packageId=${item.id}` as never)}
                >
                  {t('b2_packagesGeoPricing')}
                </Text>
                <Text style={styles.delete} onPress={() => onDelete(item)}>
                  {t('b2_packagesDelete')}
                </Text>
              </View>
            </Pressable>
          );
        }}
        emptyIcon="pricetags-outline"
        emptyTitle={t('b2_packagesEmptyTitle')}
        emptyMessage="Upload your package brochure (PDF or photo) with AI or add packages manually."
        emptyAction={{ label: 'Upload with AI', onPress: () => openAiUpload(false) }}
      />
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderHelpAndAdd label="Add package" onPress={() => openAiUpload(false)} />
          ),
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  headerBlock: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  actionCardsWrap: {
    gap: spacing.sm,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  actionCardPrimary: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  actionIconCirclePrimary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionTitlePrimary: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: onFill,
  },
  aiBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  aiBadgeText: {
    fontSize: 9.5,
    fontWeight: fontWeight.extrabold,
    color: onFill,
    letterSpacing: 0.4,
  },
  actionSubtitlePrimary: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 16,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryActionCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    gap: 4,
  },
  secondaryActionCardSuggested: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  secondaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  secondaryIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  suggestedPillText: {
    fontSize: 9,
    fontWeight: fontWeight.extrabold,
    color: onFill,
    letterSpacing: 0.4,
  },
  secondaryActionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  secondaryActionSub: {
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 15,
  },
  sessionTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sessionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  sessionTabActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  sessionTabText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  sessionTabTextActive: {
    color: onFill,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.sm,
  },
  cardDiamond: {
    borderColor: c.primary,
  },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleGroup: {
    flex: 1,
    gap: 4,
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  topTierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  topTierBadgeText: {
    fontSize: 9.5,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: c.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  sessionBadgeText: {
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  priceBadge: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
  },
  priceUnitText: {
    fontSize: 10.5,
    color: c.textMuted,
  },
  desc: {
    fontSize: fontSize.xs,
    color: c.textSoft,
    lineHeight: 17,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  metricChipText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  ingredientsBox: {
    backgroundColor: c.card,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  ingredientLine: {
    fontSize: 11.5,
    color: c.textSoft,
  },
  moreIngredientsText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.primary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  editHint: {
    fontSize: fontSize.xs,
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  geoLink: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  delete: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.error,
  },
}));
