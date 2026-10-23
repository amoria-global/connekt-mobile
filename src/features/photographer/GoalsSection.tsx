/**
 * Photographer goals on Home, backed by the same `/photographer/plans` the web
 * uses. Honest by construction:
 *   - A goal appears only after the server has saved it; a failed save keeps the
 *     form open with the error, nothing is shown as saved.
 *   - Targets are shown as targets. Progress is shown only where a real current
 *     value exists (the rating, from reviews). Earnings and client progress for a
 *     period would need per-period figures the server cannot give in one currency
 *     yet, so those say so instead of drawing a made-up bar.
 */
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Sheet } from '@/components/ui/Sheet';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { ActionButton, Card, EmptyNote, ErrorNotice, HCarousel, SectionHeader, SegmentedTabs, SkeletonCard, TOUCH } from './kit';
import { moneyText } from './money';
import {
  createPlan,
  deletePlan,
  draftOf,
  emptyDraft,
  listPlans,
  PLAN_PERIODS,
  periodLabel,
  updatePlan,
  validateDraft,
  type DraftErrors,
  type Plan,
  type PlanDraft,
} from './plans';

type Editing = { plan: Plan | null } | null;

export function GoalsSection({ rating, hidden }: { rating: number | null; hidden?: boolean }) {
  const styles = useStyles();
  const plans = useAsync(listPlans);
  const [editing, setEditing] = useState<Editing>(null);
  const list = plans.data ?? [];

  const onSaved = useCallback(() => {
    setEditing(null);
    return plans.refresh();
  }, [plans]);

  return (
    <View>
      <SectionHeader
        title="Goals"
        subtitle="Targets you set for yourself"
        actionLabel={plans.data ? 'Add goal' : undefined}
        onAction={plans.data ? () => setEditing({ plan: null }) : undefined}
      />
      {plans.error && !plans.data ? (
        <ErrorNotice message={plans.error} onRetry={plans.refresh} />
      ) : plans.loading && !plans.data ? (
        <SkeletonCard height={120} />
      ) : list.length === 0 ? (
        <EmptyNote
          compact
          icon="flag-outline"
          title="No goals yet"
          body="Set an earnings target for a week, a month or your own dates."
          actionLabel="Set a goal"
          onAction={() => setEditing({ plan: null })}
        />
      ) : (
        <HCarousel
          label="Your goals"
          data={list}
          keyOf={(p) => p.id}
          renderItem={(p) => <GoalCard plan={p} rating={rating} hidden={hidden} onEdit={() => setEditing({ plan: p })} />}
        />
      )}
      {plans.error && plans.data ? <ErrorNotice compact message={plans.error} onRetry={plans.refresh} /> : null}
      {editing ? <GoalForm plan={editing.plan} onClose={() => setEditing(null)} onSaved={onSaved} /> : null}
      <View style={styles.spacer} />
    </View>
  );
}

function GoalCard({ plan, rating, hidden, onEdit }: { plan: Plan; rating: number | null; hidden?: boolean; onEdit: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const ratingPct = plan.targetRatings > 0 && rating != null ? Math.min(100, Math.round((rating / plan.targetRatings) * 100)) : null;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`Goal ${plan.name}, ${periodLabel(plan)}. Edit`}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Card style={[styles.goal, { marginHorizontal: 0 }]}>
        <View style={styles.goalTop}>
          <Text style={styles.goalName} numberOfLines={1}>
            {plan.name}
          </Text>
          <Ionicons name="create-outline" size={18} color={colors.textMuted} />
        </View>
        <Text style={styles.muted}>{tr(periodLabel(plan))}</Text>
        <Text style={styles.goalValue}>{moneyText(plan.targetEarnings, 'USD', hidden)}</Text>
        <Text style={styles.muted}>{tr('Earnings target')}</Text>
        {plan.targetClients > 0 ? <Text style={styles.line}>{plan.targetClients} {tr('Clients').toLowerCase()}</Text> : null}
        {plan.targetRatings > 0 ? (
          <View>
            <Text style={styles.line}>
              {tr('Rating target')} {plan.targetRatings.toFixed(1)}
              {rating != null ? `, now ${rating.toFixed(1)}` : `, ${tr('No reviews yet').toLowerCase()}`}
            </Text>
            {ratingPct != null ? (
              <View style={styles.track} accessible accessibilityLabel={`Rating is ${ratingPct} percent of the target`}>
                <View style={[styles.fill, { width: `${Math.max(2, ratingPct)}%` }]} />
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.note}>{tr('Earnings progress needs per-period figures, not available yet.')}</Text>
      </Card>
    </Pressable>
  );
}

function GoalForm({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const [draft, setDraft] = useState<PlanDraft>(plan ? draftOf(plan) : emptyDraft());
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const run = async (op: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setFailure(null);
    try {
      await op();
    } catch (e) {
      setFailure(isApiError(e) ? e.message : fallback);
      setBusy(false);
      return;
    }
    // Saved on the server. Closing and re-reading is the confirmation.
    await onSaved();
  };

  const save = () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void run(() => (plan ? updatePlan(plan.id, draft) : createPlan(draft)), 'Could not save this goal. Please try again.');
  };

  const remove = () => {
    if (!plan) return;
    Alert.alert('Delete this goal?', plan.name, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void run(() => deletePlan(plan.id), 'Could not delete this goal. Please try again.'),
      },
    ]);
  };

  const field = (
    key: keyof PlanDraft,
    label: string,
    placeholder: string,
    keyboard: 'default' | 'decimal-pad' | 'number-pad' = 'decimal-pad',
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{tr(label)}</Text>
      <TextInput
        value={draft[key]}
        onChangeText={(t) => set(key, t as never)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboard}
        editable={!busy}
        accessibilityLabel={label}
        style={[styles.input, errors[key] ? { borderColor: colors.error } : null]}
      />
      {errors[key] ? (
        <Text style={[styles.err, { color: colors.error }]} accessibilityRole="alert">
          {errors[key]}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Sheet
      title={tr(plan ? 'Edit goal' : 'New goal')}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {failure ? <ErrorNotice compact message={failure} /> : null}
          <ActionButton label={busy ? 'Saving...' : 'Save goal'} variant="primary" busy={busy} onPress={save} />
          {plan ? <ActionButton label="Delete goal" variant="destructive" disabled={busy} onPress={remove} /> : null}
        </>
      }
    >
      {field('name', 'Goal name', 'e.g. October earnings', 'default')}
      <Text style={styles.label}>{tr('Period')}</Text>
      {/* SegmentedTabs carries its own side margin; cancel the sheet's padding so it lines up with the fields. */}
      <View style={{ marginHorizontal: -spacing.lg }}>
        <SegmentedTabs tabs={PLAN_PERIODS} value={draft.timePeriod} onChange={(v) => set('timePeriod', v)} label="Goal period" />
      </View>
      {draft.timePeriod === 'custom' ? (
        <>
          {field('customStartDate', 'Start date', 'YYYY-MM-DD', 'default')}
          {field('customEndDate', 'End date', 'YYYY-MM-DD', 'default')}
        </>
      ) : null}
      {field('targetEarnings', 'Earnings target (USD)', 'e.g. 5000')}
      {field('targetPending', 'Pending target (USD, optional)', 'e.g. 500')}
      {field('targetClients', 'Clients target (optional)', 'e.g. 10', 'number-pad')}
      {field('targetBonuses', 'Bonuses target (USD, optional)', 'e.g. 100')}
      {field('targetRatings', 'Rating target (0 to 5, optional)', 'e.g. 4.5')}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  spacer: { height: spacing.sm },
  goal: { gap: 4 },
  goalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  goalName: { flex: 1, color: c.text, fontSize: 16, fontWeight: '700' },
  goalValue: { color: c.text, fontSize: 24, fontWeight: '800', marginTop: spacing.sm },
  muted: { color: c.textMuted, fontSize: 13 },
  line: { color: c.textSoft, fontSize: 14, marginTop: 4 },
  note: { color: c.textMuted, fontSize: 12, lineHeight: 16, marginTop: spacing.sm },
  track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceMuted, overflow: 'hidden', marginTop: 6 },
  fill: { height: 6, borderRadius: 3, backgroundColor: c.primary },
  field: { gap: 4 },
  label: { color: c.textSoft, fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: c.text,
    backgroundColor: c.surface,
    fontSize: 16,
  },
  err: { fontSize: 12 },
}));
