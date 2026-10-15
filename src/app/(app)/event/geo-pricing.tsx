/**
 * Geo-pricing manager (event owner).
 *
 * Set different stream prices per location. Priority: a country price wins
 * over a continent price, which wins over the event's default. Anywhere you
 * don't set a price, viewers pay the event's default.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAsync } from '@/hooks/useAsync';
import { listCurrencies, type Currency } from '@/features/reference/api';
import { useRole } from '@/features/auth/role';
import { listCoordinatorEvents } from '@/features/events/api';
import {
  deleteGeoPrice,
  deletePackageGeoPrice,
  getGeoPricing,
  getPackageGeoPricing,
  upsertGeoPrice,
  upsertPackageGeoPrice,
  type GeoPriceRule,
  type GeoScope,
} from '@/features/geopricing/api';
import {
  CONTINENTS,
  COUNTRIES,
  ALL_REGIONS,
  continentLabel,
  countryLabel,
  regionLabel,
  type GeoRegionItem,
} from '@/features/geopricing/regions';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

export default function GeoPricingScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const { eventId, packageId } = useLocalSearchParams<{ eventId?: string; packageId?: string }>();
  const { isCoordinator } = useRole();
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(eventId);

  const eventsAsync = useAsync(
    useCallback(
      () => (isCoordinator && !packageId ? listCoordinatorEvents() : Promise.resolve([])),
      [isCoordinator, packageId],
    ),
  );

  // Auto-select first event if none specified
  useEffect(() => {
    if (!selectedEventId && !packageId && eventsAsync.data && eventsAsync.data.length > 0) {
      setSelectedEventId(eventsAsync.data[0].id);
    }
  }, [eventsAsync.data, selectedEventId, packageId]);

  // One screen prices either an event's stream or a photographer package.
  const isPackage = !!packageId;
  const activeTargetId = isPackage ? String(packageId) : String(selectedEventId ?? eventId ?? '');

  const config = useAsync(
    useCallback(
      () => {
        if (!activeTargetId || activeTargetId === 'undefined') {
          return Promise.resolve({ defaultPrice: null, rules: [] });
        }
        return isPackage ? getPackageGeoPricing(activeTargetId) : getGeoPricing(activeTargetId);
      },
      [isPackage, activeTargetId],
    ),
  );
  const currencies = useAsync(useCallback(() => listCurrencies(), []));

  type GeoFilterTab = 'ALL' | 'CONTINENT' | 'COUNTRY';
  const [filterTab, setFilterTab] = useState<GeoFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<GeoRegionItem[]>([]);
  const [price, setPrice] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = config.data?.rules ?? [];
  const defaultCurrency = config.data?.defaultCurrencyAbbreviation;

  // Default the currency picker to the event's default currency once loaded.
  const effectiveCurrencyId = currencyId || config.data?.defaultCurrencyId || '';

  const filteredRegions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list: GeoRegionItem[] = [];
    if (filterTab === 'CONTINENT') {
      list = CONTINENTS.map((c) => ({ scopeType: 'CONTINENT' as const, code: c.code, label: c.label }));
    } else if (filterTab === 'COUNTRY') {
      list = COUNTRIES.map((c) => ({ scopeType: 'COUNTRY' as const, code: c.code, label: c.label }));
    } else {
      list = ALL_REGIONS;
    }
    if (!q) return list;
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.scopeType === 'CONTINENT' ? 'continent' : 'country').includes(q),
    );
  }, [filterTab, searchQuery]);

  const toggleLocation = (item: GeoRegionItem) => {
    setError(null);
    setSelectedLocations((prev) => {
      const exists = prev.some((x) => x.scopeType === item.scopeType && x.code === item.code);
      if (exists) {
        return prev.filter((x) => !(x.scopeType === item.scopeType && x.code === item.code));
      }
      return [...prev, item];
    });
  };

  const removeSelectedLocation = (item: GeoRegionItem) => {
    setSelectedLocations((prev) =>
      prev.filter((x) => !(x.scopeType === item.scopeType && x.code === item.code)),
    );
  };

  const clearSelectedLocations = () => {
    setSelectedLocations([]);
    setError(null);
  };

  const selectAllMatching = () => {
    setSelectedLocations((prev) => {
      const merged = [...prev];
      for (const item of filteredRegions) {
        if (!merged.some((m) => m.scopeType === item.scopeType && m.code === item.code)) {
          merged.push(item);
        }
      }
      return merged;
    });
  };

  const onSave = async () => {
    setError(null);
    if (selectedLocations.length === 0) return setError('Pick at least one continent or country.');
    const p = Number(price);
    if (!price || Number.isNaN(p) || p < 0) return setError('Enter a valid price.');
    setSaving(true);
    try {
      await Promise.all(
        selectedLocations.map((loc) => {
          const payload = {
            scopeType: loc.scopeType,
            scopeValue: loc.code,
            price: p,
            currencyId: effectiveCurrencyId || undefined,
          };
          return isPackage
            ? upsertPackageGeoPrice(activeTargetId, payload)
            : upsertGeoPrice(activeTargetId, payload);
        }),
      );
      setSelectedLocations([]);
      setPrice('');
      setSearchQuery('');
      config.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the prices.');
    } finally {
      setSaving(false);
    }
  };

  const onClearAll = () => {
    if (rules.length === 0) return;
    Alert.alert(
      'Remove all location prices?',
      'Are you sure you want to remove all custom location prices? Viewers will pay the default stream price.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove all',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(
                rules.map((r) =>
                  isPackage
                    ? deletePackageGeoPrice(activeTargetId, r.id)
                    : deleteGeoPrice(activeTargetId, r.id),
                ),
              );
              config.refresh();
            } catch {
              Alert.alert('Error', 'Could not remove all location prices.');
            }
          },
        },
      ],
    );
  };

  const onDelete = (rule: GeoPriceRule) => {
    Alert.alert('Remove price', `Remove the price for ${labelFor(rule)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await (isPackage ? deletePackageGeoPrice(activeTargetId, rule.id) : deleteGeoPrice(activeTargetId, rule.id));
            config.refresh();
          } catch {
            Alert.alert('Error', 'Could not remove the price.');
          }
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Geo pricing" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {eventsAsync.data && eventsAsync.data.length > 0 && !packageId ? (
          <View style={styles.eventPickerCard}>
            <Text style={styles.eventPickerLabel}>Select Event to Price:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventPickerScroll}
            >
              {eventsAsync.data.map((ev) => {
                const active = activeTargetId === ev.id;
                return (
                  <Pressable
                    key={ev.id}
                    onPress={() => setSelectedEventId(ev.id)}
                    style={[styles.eventChip, active && styles.eventChipActive]}
                  >
                    <Text style={[styles.eventChipText, active && styles.eventChipTextActive]}>
                      {ev.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.introCard}>
          <Ionicons name="earth" size={20} color={colors.primary} />
          <Text style={styles.introText}>
            Charge different prices by location. A <Text style={styles.bold}>country</Text> price beats a{' '}
            <Text style={styles.bold}>continent</Text> price, which beats your{' '}
            <Text style={styles.bold}>default</Text>. Anywhere without a rule pays the default
            {config.data?.defaultPrice != null
              ? ` (${config.data.defaultPrice} ${defaultCurrency ?? ''})`
              : ''}
            .
          </Text>
        </View>

        {/* Existing rules */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Location prices ({rules.length})</Text>
          {rules.length > 0 ? (
            <Pressable onPress={onClearAll} hitSlop={6}>
              <Text style={styles.clearAllLink}>Remove all</Text>
            </Pressable>
          ) : null}
        </View>
        {config.loading && !config.data ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : rules.length === 0 ? (
          <Text style={styles.muted}>No location prices yet. Everyone pays your default price.</Text>
        ) : (
          <View style={styles.card}>
            {rules.map((r, i) => (
              <View key={r.id} style={[styles.ruleRow, i < rules.length - 1 && styles.ruleBorder]}>
                <View style={styles.ruleBadge}>
                  <Ionicons
                    name={r.scopeType === 'CONTINENT' ? 'globe-outline' : 'flag-outline'}
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.ruleName}>{regionLabel(r.scopeType, r.scopeValue)}</Text>
                  <Text style={styles.ruleMeta}>{r.scopeType === 'CONTINENT' ? 'Continent' : 'Country'}</Text>
                </View>
                <Text style={styles.rulePrice}>
                  {formatPrice(Number(r.price), r.currencyAbbreviation ?? defaultCurrency ?? undefined)}
                </Text>
                <Pressable onPress={() => onDelete(r)} hitSlop={8} style={styles.delBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Add / update rule */}
        <Text style={styles.sectionTitle}>Add a location price</Text>
        <View style={styles.card}>
          {/* Scope Filter Tabs */}
          <View style={styles.segment}>
            {(['ALL', 'CONTINENT', 'COUNTRY'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setFilterTab(s)}
                style={[styles.segBtn, filterTab === s && styles.segBtnActive]}
              >
                <Text style={[styles.segText, filterTab === s && styles.segTextActive]}>
                  {s === 'ALL' ? 'All' : s === 'CONTINENT' ? 'Continents' : 'Countries'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Search bar */}
          <Input
            placeholder="Search continent or country (e.g. Africa, Rwanda, UK)..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftElement={
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.textMuted}
                style={{ marginLeft: spacing.sm, marginRight: spacing.xs }}
              />
            }
          />

          {/* Selected locations tray */}
          {selectedLocations.length > 0 ? (
            <View style={styles.selectedLocationsTray}>
              <View style={styles.selectedLocationsHeader}>
                <Text style={styles.selectedLocationsCount}>
                  Selected ({selectedLocations.length}):
                </Text>
                <Pressable onPress={clearSelectedLocations} hitSlop={6}>
                  <Text style={styles.clearSelectionLink}>Clear all</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectedChipsScroll}
              >
                {selectedLocations.map((item) => (
                  <Pressable
                    key={`${item.scopeType}-${item.code}`}
                    onPress={() => removeSelectedLocation(item)}
                    style={styles.selectedTrayChip}
                  >
                    <Ionicons
                      name={item.scopeType === 'CONTINENT' ? 'globe-outline' : 'flag-outline'}
                      size={13}
                      color={colors.primary}
                    />
                    <Text style={styles.selectedTrayChipText}>
                      {item.label} ({item.scopeType === 'CONTINENT' ? 'Continent' : 'Country'})
                    </Text>
                    <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Locations Options Scroll Area */}
          <View style={styles.locationsListContainer}>
            <View style={styles.locationsListHeaderRow}>
              <Text style={styles.locationsAvailableText}>
                {filteredRegions.length} available
              </Text>
              {filteredRegions.length > 1 && filteredRegions.length <= 15 ? (
                <Pressable onPress={selectAllMatching} hitSlop={6}>
                  <Text style={styles.selectAllLink}>Select all shown</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              style={styles.locationsScrollArea}
              contentContainerStyle={styles.locationsWrap}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {filteredRegions.map((item) => {
                const isSelected = selectedLocations.some(
                  (x) => x.scopeType === item.scopeType && x.code === item.code,
                );
                const hasExistingRule = rules.some(
                  (r) => r.scopeType === item.scopeType && r.scopeValue === item.code,
                );
                return (
                  <Pressable
                    key={`${item.scopeType}-${item.code}`}
                    onPress={() => toggleLocation(item)}
                    style={[
                      styles.geoItemChip,
                      isSelected && styles.geoItemChipSelected,
                      hasExistingRule && !isSelected && styles.geoItemChipHasRule,
                    ]}
                  >
                    <Ionicons
                      name={
                        isSelected
                          ? 'checkmark-circle'
                          : item.scopeType === 'CONTINENT'
                            ? 'globe-outline'
                            : 'flag-outline'
                      }
                      size={14}
                      color={
                        isSelected
                          ? '#fff'
                          : hasExistingRule
                            ? colors.primary
                            : colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.geoItemChipText,
                        isSelected && styles.geoItemChipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {filterTab === 'ALL' ? (
                      <Text
                        style={[
                          styles.geoItemScopeBadge,
                          isSelected && styles.geoItemScopeBadgeSelected,
                        ]}
                      >
                        {item.scopeType === 'CONTINENT' ? 'Cont' : 'Ctry'}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {filteredRegions.length === 0 ? (
                <Text style={styles.noMatchText}>No regions match "{searchQuery}".</Text>
              ) : null}
            </ScrollView>
          </View>

          <Input
            label={
              selectedLocations.length > 1
                ? `Price for ${selectedLocations.length} locations`
                : selectedLocations.length === 1
                  ? `Price for ${selectedLocations[0].label}`
                  : 'Price'
            }
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          {currencies.data && currencies.data.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Currency</Text>
              <View style={styles.chips}>
                {currencies.data.map((c: Currency) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCurrencyId(c.id)}
                    style={[styles.chip, effectiveCurrencyId === c.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, effectiveCurrencyId === c.id && styles.chipTextActive]}>
                      {c.code}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={
              selectedLocations.length > 1
                ? `Apply Price (${price || '0'} ${currencies.data?.find((c) => c.id === effectiveCurrencyId)?.code || defaultCurrency || ''}) to ${selectedLocations.length} Locations`
                : selectedLocations.length === 1
                  ? `Save Price for ${selectedLocations[0].label}`
                  : 'Save Price'
            }
            onPress={onSave}
            loading={saving}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function labelFor(r: GeoPriceRule): string {
  return r.scopeType === 'CONTINENT' ? continentLabel(r.scopeValue) : countryLabel(r.scopeValue);
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  introCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: c.infoBg,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  introText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
  bold: { fontFamily: fonts.bold, color: c.primary },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: c.text },
  clearAllLink: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: c.error },
  muted: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },

  selectedLocationsTray: {
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  selectedLocationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedLocationsCount: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  clearSelectionLink: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.primary,
  },
  selectedChipsScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  selectedTrayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.primary,
  },
  selectedTrayChipText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  locationsListContainer: {
    gap: 4,
    marginTop: 2,
  },
  locationsListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  locationsAvailableText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  selectAllLink: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },
  locationsScrollArea: {
    maxHeight: 180,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceMuted,
    padding: spacing.sm,
  },
  locationsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  geoItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  geoItemChipSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  geoItemChipHasRule: {
    borderColor: c.primary,
    borderStyle: 'dashed',
  },
  geoItemChipText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.text,
  },
  geoItemChipTextSelected: {
    color: '#fff',
    fontFamily: fonts.bold,
  },
  geoItemScopeBadge: {
    fontSize: 9,
    color: c.textMuted,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: c.surfaceMuted,
    textTransform: 'uppercase',
  },
  geoItemScopeBadgeSelected: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  noMatchText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
    textAlign: 'center',
    width: '100%',
  },

  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.md,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  ruleBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  ruleBadge: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: c.infoBg,
    alignItems: 'center', justifyContent: 'center',
  },
  ruleName: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.text },
  ruleMeta: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.textMuted },
  rulePrice: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.primary },
  delBtn: { padding: 4 },

  segment: { flexDirection: 'row', backgroundColor: c.surfaceMuted, borderRadius: radii.full, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radii.full },
  segBtnActive: { backgroundColor: c.surface },
  segText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.textMuted },
  segTextActive: { color: c.primary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.full,
    borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.surface,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.text },
  chipTextActive: { color: '#fff', fontFamily: fonts.bold },

  fieldLabel: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.textMuted },
  error: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.error },

  eventPickerCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  eventPickerLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  eventPickerScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  eventChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceMuted,
  },
  eventChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  eventChipText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.text,
  },
  eventChipTextActive: {
    color: '#fff',
    fontFamily: fonts.bold,
  },
}));
