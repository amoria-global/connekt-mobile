/**
 * Location pricing & access (event owner): the same inline field as the event form, on its own screen for an event or a
 * photographer package that already exists. Saving applies the changes one rule at a time (the dedicated endpoints), so
 * each failure is reported by name; an event's rules can also be edited in the event form, where they save with the event.
 *
 * Priority: a country rule wins over its continent, which wins over the default price. On an event a place can also be
 * blocked; a block wins over a price in the same place. A package takes prices only.
 */
import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAsync } from '@/hooks/useAsync';
import { listCurrencies } from '@/features/reference/api';
import { useRole } from '@/features/auth/role';
import { listCoordinatorEvents } from '@/features/events/api';
import {
  deleteGeoPrice,
  deletePackageGeoPrice,
  getGeoPricing,
  getPackageGeoPricing,
  upsertGeoPrice,
  upsertPackageGeoPrice,
} from '@/features/geopricing/api';
import { LocationRulesField } from '@/features/geopricing/LocationRulesField';
import { diffRules, ruleFromServer, type LocationRule } from '@/features/geopricing/locationRules';
import { useLocationRules } from '@/features/geopricing/useLocationRules';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

export default function GeoPricingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { eventId, packageId } = useLocalSearchParams<{ eventId?: string; packageId?: string }>();
  const { isCoordinator } = useRole();
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(eventId);

  const eventsAsync = useAsync(
    useCallback(() => (isCoordinator && !packageId ? listCoordinatorEvents() : Promise.resolve([])), [isCoordinator, packageId]),
  );

  // One screen prices either an event's stream or a photographer package.
  const isPackage = !!packageId;
  // With no event named, the first of the owner's events is the one shown.
  const activeTargetId = isPackage ? String(packageId) : String(selectedEventId ?? eventId ?? eventsAsync.data?.[0]?.id ?? '');

  const config = useAsync(
    useCallback(() => {
      if (!activeTargetId || activeTargetId === 'undefined') return Promise.resolve({ defaultPrice: null, rules: [] });
      return isPackage ? getPackageGeoPricing(activeTargetId) : getGeoPricing(activeTargetId);
    }, [isPackage, activeTargetId]),
  );
  const currencies = useAsync(useCallback(() => listCurrencies(), []));

  const geo = useLocationRules({ initiallyOpen: true });
  const { hydrate } = geo;
  const [saved, setSaved] = useState<LocationRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The saved rules go into the field whenever they are (re)loaded: a new answer from the server replaces what is shown.
  const [shownFor, setShownFor] = useState<unknown>(null);
  if (config.data && shownFor !== config.data) {
    const next = (config.data.rules ?? []).map(ruleFromServer);
    setShownFor(config.data);
    setSaved(next);
    hydrate(next);
  }

  const changes = useMemo(() => diffRules(saved, geo.rules), [saved, geo.rules]);
  const dirty = changes.upserts.length + changes.deletes.length > 0;
  const defaultCurrencyId = config.data?.defaultCurrencyId;

  const onSave = async () => {
    if (geo.blockSave()) return;
    if (!dirty) return;
    setError(null);
    setSaving(true);
    const target = activeTargetId;
    const jobs = [
      ...changes.upserts.map((r) =>
        isPackage
          ? upsertPackageGeoPrice(target, { scopeType: r.scopeType, scopeValue: r.scopeValue, price: r.price ?? 0, currencyId: r.currencyId })
          : upsertGeoPrice(target, {
              scopeType: r.scopeType,
              scopeValue: r.scopeValue,
              action: r.action,
              price: r.action === 'PRICE' ? r.price : undefined,
              currencyId: r.action === 'PRICE' ? r.currencyId : undefined,
            }),
      ),
      ...changes.deletes.map((r) => (isPackage ? deletePackageGeoPrice(target, r.id!) : deleteGeoPrice(target, r.id!))),
    ];
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
    if (failed.length > 0) {
      const why = failed[0].reason instanceof Error ? failed[0].reason.message : 'A change could not be saved.';
      setError(failed.length === 1 ? why : `${failed.length} changes could not be saved. ${why}`);
    }
    // Reload either way, so the screen always shows what the server has.
    await config.refresh();
    setSaving(false);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader duplicatesHeader title="Location pricing & access" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {eventsAsync.data && eventsAsync.data.length > 0 && !packageId ? (
          <View style={styles.eventPickerCard}>
            <Text style={styles.eventPickerLabel}>Choose an event</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventPickerScroll}>
              {eventsAsync.data.map((ev) => {
                const active = activeTargetId === ev.id;
                return (
                  <Pressable
                    key={ev.id}
                    onPress={() => setSelectedEventId(ev.id)}
                    style={[styles.eventChip, active && styles.eventChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.eventChipText, active && styles.eventChipTextActive]}>{ev.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {config.data?.defaultPrice != null ? (
          <View style={styles.introCard}>
            <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
            <Text style={styles.introText}>
              {`Default price: ${config.data.defaultPrice} ${config.data.defaultCurrencyAbbreviation ?? ''}. Anywhere without a rule pays this.`}
            </Text>
          </View>
        ) : null}

        {config.loading && !config.data ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : config.error ? (
          <View style={styles.introCard}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
            <Text style={styles.introText}>{'We could not load the saved rules. Pull to try again, or reopen this screen.'}</Text>
          </View>
        ) : (
          <LocationRulesField
            expanded={geo.expanded}
            onToggle={geo.toggle}
            rules={geo.rules}
            onRulesChange={geo.setRules}
            draft={geo.draft}
            onDraftChange={geo.onDraftChange}
            locations={geo.locations}
            locationsStatus={geo.status}
            onRetryLocations={geo.retry}
            currencies={currencies.data ?? []}
            defaultCurrencyId={defaultCurrencyId}
            message={geo.message}
            ruleErrors={geo.ruleErrors}
            allowBlock={!isPackage}
            testID="geo-manager"
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          title={dirty ? 'Save changes' : 'Saved'}
          onPress={onSave}
          loading={saving}
          disabled={!dirty || saving || !activeTargetId}
          testID="geo-manager-save"
        />
      </ScrollView>
    </Screen>
  );
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
  error: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.error },
  eventPickerCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  eventPickerLabel: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: c.textMuted, textTransform: 'uppercase' },
  eventPickerScroll: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  eventChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceMuted,
  },
  eventChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  eventChipText: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.text },
  eventChipTextActive: { color: c.textOnPrimary, fontFamily: fonts.bold },
}));
