/**
 * "Location pricing & access (optional)": an inline, collapsible form field. Collapsed it is one row with a summary
 * line; open it lists the event's location rules and a single inline row to add the next one (search a country or
 * continent, choose Price or Block, enter the price). It holds no state of its own beyond the search text: the form
 * owns the rules and the open draft, saves them with the event, and sees the server's field errors.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Segmented } from '@/components/ui/Segmented';
import { MoneyInput } from '@/components/ui/MoneyInput';
import type { Currency } from '@/features/reference/api';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import {
  OPEN_RULE_HINT,
  PRECEDENCE_HINT,
  describeRule,
  draftProblem,
  ruleValue,
  ruleFromDraft,
  searchLocations,
  sortRules,
  summarize,
  type GeoLocation,
  type LocationRule,
  type RuleAction,
  type RuleDraft,
} from './locationRules';

export type LocationsStatus = 'loading' | 'ready' | 'error';

type Props = {
  expanded: boolean;
  onToggle: () => void;
  rules: LocationRule[];
  onRulesChange: (rules: LocationRule[]) => void;
  /** The new-rule row's contents, or null while no rule is open. */
  draft: RuleDraft | null;
  onDraftChange: (draft: RuleDraft | null) => void;
  locations: GeoLocation[];
  locationsStatus: LocationsStatus;
  onRetryLocations: () => void;
  currencies: Currency[];
  /** The currency a new price starts in. */
  defaultCurrencyId?: string;
  /** Shown under the field, e.g. "Finish or cancel the open rule first." or a server error with no row. */
  message?: string | null;
  /** A server error for a rule, by its index in `rules` (the order the form sent them). */
  ruleErrors?: Record<number, string>;
  testID?: string;
};

export function LocationRulesField({
  expanded,
  onToggle,
  rules,
  onRulesChange,
  draft,
  onDraftChange,
  locations,
  locationsStatus,
  onRetryLocations,
  currencies,
  defaultCurrencyId,
  message,
  ruleErrors,
  testID = 'geo-rules',
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const ordered = useMemo(() => sortRules(rules), [rules]);
  const matches = useMemo(
    () => (draft && !draft.location ? searchLocations(locations, query, rules) : []),
    [draft, locations, query, rules],
  );

  const openNew = () => {
    setProblem(null);
    setQuery('');
    const cur = currencies.find((c) => c.id === defaultCurrencyId) ?? currencies[0];
    onDraftChange({ location: null, action: 'PRICE', priceText: '', currencyId: cur?.id, currencyCode: cur?.code });
  };

  const cancel = () => {
    setProblem(null);
    setQuery('');
    onDraftChange(null);
  };

  const add = () => {
    if (!draft) return;
    const why = draftProblem(draft, rules);
    if (why) {
      setProblem(why);
      return;
    }
    const rule = ruleFromDraft(draft, rules);
    if (!rule) return;
    onRulesChange([...rules, rule]);
    cancel();
  };

  const edit = (rule: LocationRule) => {
    if (draft) {
      setProblem(OPEN_RULE_HINT);
      return;
    }
    onRulesChange(rules.filter((r) => r.key !== rule.key));
    setQuery('');
    setProblem(null);
    onDraftChange({
      location: { scopeType: rule.scopeType, code: rule.scopeValue, name: rule.label },
      action: rule.action,
      priceText: rule.price != null ? String(rule.price) : '',
      currencyId: rule.currencyId,
      currencyCode: rule.currencyCode,
    });
  };

  const remove = (rule: LocationRule) => onRulesChange(rules.filter((r) => r.key !== rule.key));

  const setAction = (action: RuleAction) => draft && onDraftChange({ ...draft, action });

  return (
    <View style={styles.card} testID={testID}>
      <Pressable
        onPress={onToggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Location pricing and access, optional"
        testID={`${testID}-header`}
      >
        <View style={styles.headerIcon}>
          <Ionicons name="earth" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Location pricing & access (optional)</Text>
          <Text style={styles.summary} testID={`${testID}-summary`}>
            {summarize(rules)}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.hint}>
            Charge a different price in some places, or keep a place from watching at all. {PRECEDENCE_HINT}
          </Text>

          {ordered.length === 0 && !draft ? (
            <Text style={styles.empty}>No location rules yet. Everyone pays the same price.</Text>
          ) : null}

          {ordered.map((rule) => {
            const idx = rules.indexOf(rule);
            const err = ruleErrors?.[idx];
            const blocked = rule.action === 'BLOCK';
            return (
              <View key={rule.key} style={[styles.row, err ? styles.rowError : null]} testID={`${testID}-row-${rule.key}`}>
                <Pressable style={styles.rowMain} onPress={() => edit(rule)} accessibilityRole="button" accessibilityLabel={`Edit ${describeRule(rule)}`}>
                  <Ionicons
                    name={blocked ? 'ban' : rule.scopeType === 'COUNTRY' ? 'flag-outline' : 'globe-outline'}
                    size={18}
                    color={blocked ? colors.error : colors.primary}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{rule.label}</Text>
                    <Text style={styles.rowSub}>{rule.scopeType === 'COUNTRY' ? 'Country' : 'Continent'}</Text>
                  </View>
                  <View style={[styles.badge, blocked ? styles.badgeBlock : styles.badgePrice]}>
                    <Text style={[styles.badgeText, blocked ? styles.badgeTextBlock : styles.badgeTextPrice]}>
                      {ruleValue(rule)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => remove(rule)}
                  hitSlop={10}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${rule.label}`}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
                {err ? <Text style={styles.rowErrText}>{err}</Text> : null}
              </View>
            );
          })}

          {draft ? (
            <View style={styles.draft} testID={`${testID}-draft`}>
              {draft.location ? (
                <View style={styles.chosen}>
                  <Ionicons name={draft.location.scopeType === 'COUNTRY' ? 'flag-outline' : 'globe-outline'} size={18} color={colors.primary} />
                  <Text style={styles.chosenText}>{draft.location.name}</Text>
                  <Pressable
                    onPress={() => {
                      setQuery('');
                      onDraftChange({ ...draft, location: null });
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Change place"
                  >
                    <Text style={styles.link}>Change</Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <View style={styles.search}>
                    <Ionicons name="search" size={16} color={colors.textMuted} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search a country or continent"
                      placeholderTextColor={colors.textMuted}
                      style={styles.searchInput}
                      autoCorrect={false}
                      autoCapitalize="none"
                      accessibilityLabel="Search a country or continent"
                      testID={`${testID}-search`}
                    />
                  </View>
                  {locationsStatus === 'loading' ? (
                    <View style={styles.status}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.statusText}>Loading places</Text>
                    </View>
                  ) : locationsStatus === 'error' ? (
                    <View style={styles.status}>
                      <Text style={styles.statusText}>{'We could not load the list of places.'}</Text>
                      <Pressable onPress={onRetryLocations} hitSlop={8} accessibilityRole="button">
                        <Text style={styles.link}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : matches.length === 0 ? (
                    <Text style={styles.statusText}>{`No place matches "${query}".`}</Text>
                  ) : (
                    <View style={styles.results}>
                      {matches.map((l) => (
                        <Pressable
                          key={`${l.scopeType}:${l.code}`}
                          style={styles.result}
                          onPress={() => {
                            setProblem(null);
                            onDraftChange({ ...draft, location: l });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${l.name}, ${l.scopeType === 'COUNTRY' ? 'country' : 'continent'}`}
                        >
                          <Text style={styles.resultName}>{l.name}</Text>
                          <Text style={styles.resultMeta}>
                            {l.scopeType === 'COUNTRY' ? l.continentName ?? 'Country' : `Continent, ${l.countryCount ?? ''} countries`}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.gap}>
                <Segmented<RuleAction>
                  value={draft.action}
                  onChange={setAction}
                  options={[
                    { label: 'Price', value: 'PRICE' },
                    { label: 'Block', value: 'BLOCK' },
                  ]}
                />
              </View>

              {draft.action === 'PRICE' ? (
                <MoneyInput
                  label={draft.location ? `Price for ${draft.location.name}` : 'Price'}
                  value={draft.priceText}
                  onChangeText={(priceText) => onDraftChange({ ...draft, priceText })}
                  currencyId={draft.currencyId ?? ''}
                  onCurrencyChange={(id) =>
                    onDraftChange({ ...draft, currencyId: id, currencyCode: currencies.find((c) => c.id === id)?.code })
                  }
                  currencies={currencies}
                  placeholder="0.00"
                  testID={`${testID}-price`}
                />
              ) : (
                <Text style={styles.blockNote}>
                  People in {draft.location?.name ?? 'this place'} will not be able to watch, buy, send gifts or donate for this event.
                  Anyone who paid before the block keeps their access.
                </Text>
              )}

              {problem ? <Text style={styles.problem}>{problem}</Text> : null}

              <View style={styles.actions}>
                <Pressable onPress={cancel} style={styles.cancelBtn} accessibilityRole="button" hitSlop={6}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button" testID={`${testID}-add`}>
                  <Text style={styles.addText}>{draft.action === 'BLOCK' ? 'Block place' : 'Add price'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={openNew} style={styles.newBtn} accessibilityRole="button" testID={`${testID}-new`}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.newText}>Add a location rule</Text>
            </Pressable>
          )}

          {message ? (
            <Text style={styles.message} testID={`${testID}-message`}>
              {message}
            </Text>
          ) : null}
        </View>
      ) : message ? (
        <Text style={[styles.message, styles.messageClosed]} testID={`${testID}-message`}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radii.lg,
    backgroundColor: c.well,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 56 },
  headerIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
  headerText: { flex: 1, gap: 2 },
  title: { color: c.text, fontSize: fontSize.md, fontFamily: fonts.semibold, fontWeight: fontWeight.semibold },
  summary: { color: c.textSoft, fontSize: fontSize.sm, fontFamily: fonts.regular },
  body: { gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  hint: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.regular, lineHeight: 17 },
  empty: { color: c.textSoft, fontSize: fontSize.sm, fontFamily: fonts.regular },
  row: { borderWidth: 1, borderColor: c.borderSoft, borderRadius: radii.md, paddingRight: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  rowError: { borderColor: c.error },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingLeft: spacing.md, paddingVertical: spacing.sm },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { color: c.text, fontSize: fontSize.sm, fontFamily: fonts.semibold },
  rowSub: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.regular },
  rowErrText: { width: '100%', color: c.error, fontSize: fontSize.xs, fontFamily: fonts.medium, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgePrice: { borderColor: c.primaryLight },
  badgeBlock: { borderColor: c.error },
  badgeText: { fontSize: fontSize.xs, fontFamily: fonts.semibold },
  badgeTextPrice: { color: c.primaryLight },
  badgeTextBlock: { color: c.error },
  removeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  draft: { gap: spacing.md, borderWidth: 1, borderColor: c.primaryLight, borderRadius: radii.md, padding: spacing.md },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  chosenText: { flex: 1, color: c.text, fontSize: fontSize.md, fontFamily: fonts.semibold },
  link: { color: c.primaryLight, fontSize: fontSize.sm, fontFamily: fonts.semibold },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderWidth: 1, borderColor: c.stroke, borderRadius: radii.md, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minHeight: 44, color: c.text, fontSize: fontSize.md, fontFamily: fonts.regular },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  statusText: { color: c.textSoft, fontSize: fontSize.sm, fontFamily: fonts.regular, paddingVertical: spacing.sm },
  results: { marginTop: spacing.xs, borderWidth: 1, borderColor: c.borderSoft, borderRadius: radii.md, overflow: 'hidden' },
  result: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  resultName: { color: c.text, fontSize: fontSize.sm, fontFamily: fonts.semibold },
  resultMeta: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.regular },
  gap: { marginTop: spacing.xs },
  blockNote: { color: c.textSoft, fontSize: fontSize.sm, fontFamily: fonts.regular, lineHeight: 19 },
  problem: { color: c.error, fontSize: fontSize.sm, fontFamily: fonts.medium },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md },
  cancelBtn: { minHeight: 44, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: c.textSoft, fontSize: fontSize.sm, fontFamily: fonts.semibold },
  addBtn: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  addText: { color: c.textOnPrimary, fontSize: fontSize.sm, fontFamily: fonts.bold, fontWeight: fontWeight.bold },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 48, borderWidth: 1, borderStyle: 'dashed', borderColor: c.primaryLight, borderRadius: radii.md },
  newText: { color: c.primaryLight, fontSize: fontSize.sm, fontFamily: fonts.semibold },
  message: { color: c.error, fontSize: fontSize.sm, fontFamily: fonts.medium },
  messageClosed: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
}));
