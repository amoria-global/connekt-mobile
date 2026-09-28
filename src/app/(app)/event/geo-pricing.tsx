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
import { CONTINENTS, COUNTRIES, continentLabel, countryLabel } from '@/features/geopricing/regions';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

export default function GeoPricingScreen() {
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

  const [scope, setScope] = useState<GeoScope>('CONTINENT');
  const [scopeValue, setScopeValue] = useState('');
  const [price, setPrice] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = config.data?.rules ?? [];
  const defaultCurrency = config.data?.defaultCurrencyAbbreviation;

  // Default the currency picker to the event's default currency once loaded.
  const effectiveCurrencyId = currencyId || config.data?.defaultCurrencyId || '';

  const options = useMemo(
    () => (scope === 'CONTINENT' ? CONTINENTS : COUNTRIES),
    [scope],
  );

  const reset = () => {
    setScopeValue('');
    setPrice('');
    setError(null);
  };

  const onSave = async () => {
    setError(null);
    if (!scopeValue) return setError('Pick a region.');
    const p = Number(price);
    if (!price || Number.isNaN(p) || p < 0) return setError('Enter a valid price.');
    setSaving(true);
    try {
      const payload = {
        scopeType: scope,
        scopeValue,
        price: p,
        currencyId: effectiveCurrencyId || undefined,
      };
      await (isPackage ? upsertPackageGeoPrice(activeTargetId, payload) : upsertGeoPrice(activeTargetId, payload));
      reset();
      config.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the price.');
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.sectionTitle}>Location prices</Text>
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
                  <Text style={styles.ruleName}>{labelFor(r)}</Text>
                  <Text style={styles.ruleMeta}>{r.scopeType === 'CONTINENT' ? 'Continent' : 'Country'}</Text>
                </View>
                <Text style={styles.rulePrice}>
                  {r.price} {r.currencyAbbreviation ?? defaultCurrency ?? ''}
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
          <View style={styles.segment}>
            {(['CONTINENT', 'COUNTRY'] as GeoScope[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  setScope(s);
                  setScopeValue('');
                }}
                style={[styles.segBtn, scope === s && styles.segBtnActive]}
              >
                <Text style={[styles.segText, scope === s && styles.segTextActive]}>
                  {s === 'CONTINENT' ? 'Continent' : 'Country'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chips}>
            {options.map((o) => (
              <Pressable
                key={o.code}
                onPress={() => setScopeValue(o.code)}
                style={[styles.chip, scopeValue === o.code && styles.chipActive]}
              >
                <Text style={[styles.chipText, scopeValue === o.code && styles.chipTextActive]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>

          <Input
            label="Price"
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

          <Button title="Save price" onPress={onSave} loading={saving} />
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

  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: c.text, marginTop: spacing.sm },
  muted: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },

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
