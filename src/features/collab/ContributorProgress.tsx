/**
 * The owner's view of how the album's collaborators are getting on: a summary of the whole album, then one card per
 * photographer who accepted the invitation, those who need the owner first. Mirrors the dashboard's
 * `ContributorProgress.tsx`.
 *
 * Each card says, in words and numbers (colour only repeats it): how many of their photos were added, how many wait
 * for the owner, how many were not accepted, how much of the album they account for, and when they last sent something.
 * From a card the owner goes straight to that person's photos. Presentational only: the screen owns the data and the
 * words (`labels`), so the same component serves every language the screen is translated into.
 */
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme, midTones } from '@/theme';
import { PersonRow } from './components';
import { timeAgo } from './model';
import type { Contributor, ContributorState, ProgressSummary, ProgressTotals } from './progress';

/** Every sentence the cards show, with `{placeholders}`; the screen fills them from its translations. */
export interface ProgressLabels {
  title: string;
  noCollaborators: string;
  nobodyYet: string;
  summary: string;
  summaryWaiting: string;
  summaryCaughtUp: string;
  statSubmitted: string;
  statAdded: string;
  statWaiting: string;
  statNotAccepted: string;
  legendAdded: string;
  legendWaiting: string;
  legendNotAccepted: string;
  barSummary: string;
  barNone: string;
  stateWaiting: string;
  stateUpToDate: string;
  stateNotStarted: string;
  joinedAgo: string;
  noLongerCollaborator: string;
  lastPhoto: string;
  nothingSubmitted: string;
  notStartedNote: string;
  shareOfAlbum: string;
  acceptedRate: string;
  reviewTheirs: string;
  allTheirs: string;
  remove: string;
  pastCollaborators: string;
  pastNote: string;
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));
}

// Mid tones: these bars sit on either scheme (green added, magenta waiting, slate not accepted).
const COLORS = { approved: midTones.green, pending: midTones.magenta, rejected: midTones.slate } as const;

/** A stacked bar of the three outcomes. The same numbers are written beside it. */
export function ProgressBar({ approved, pending, rejected, labels, height = 10 }: {
  approved: number; pending: number; rejected: number; labels: ProgressLabels; height?: number;
}) {
  const styles = useStyles();
  const total = approved + pending + rejected;
  const a11y = total === 0 ? labels.barNone : fill(labels.barSummary, { added: approved, waiting: pending, rejected });
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y} style={[styles.bar, { height, borderRadius: height / 2 }]}>
      {approved > 0 ? <View style={{ flex: approved, backgroundColor: COLORS.approved }} /> : null}
      {pending > 0 ? <View style={{ flex: pending, backgroundColor: COLORS.pending }} /> : null}
      {rejected > 0 ? <View style={{ flex: rejected, backgroundColor: COLORS.rejected }} /> : null}
    </View>
  );
}

function Legend({ c, labels }: { c: Pick<Contributor, 'approved' | 'pending' | 'rejected'>; labels: ProgressLabels }) {
  const styles = useStyles();
  const item = (color: string, text: string) => (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
  return (
    <View style={styles.legend}>
      {item(COLORS.approved, fill(labels.legendAdded, { n: c.approved }))}
      {item(COLORS.pending, fill(labels.legendWaiting, { n: c.pending }))}
      {item(COLORS.rejected, fill(labels.legendNotAccepted, { n: c.rejected }))}
    </View>
  );
}

// ─── Album summary ───────────────────────────────────────────────

export function ProgressSummaryCard({ totals, labels }: { totals: ProgressTotals; labels: ProgressLabels }) {
  const styles = useStyles();
  const { submitted, approved, pending, rejected, collaborators, contributing, waiting } = totals;
  const sentence = collaborators === 0
    ? labels.noCollaborators
    : submitted === 0
      ? fill(labels.nobodyYet, { n: collaborators })
      : fill(labels.summary, { contributing, collabs: collaborators })
        + (waiting > 0 ? ' ' + fill(labels.summaryWaiting, { waiting }) : ' ' + labels.summaryCaughtUp);
  const stat = (label: string, value: number, color?: string) => (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.statLabelRow}>
        {color ? <View style={[styles.dotSmall, { backgroundColor: color }]} /> : null}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.card} testID="progress-summary">
      <Text style={styles.cardTitle} accessibilityRole="header">{labels.title}</Text>
      <Text style={styles.muted}>{sentence}</Text>
      <View style={styles.stats}>
        {stat(labels.statSubmitted, submitted)}
        {stat(labels.statAdded, approved, COLORS.approved)}
        {stat(labels.statWaiting, pending, COLORS.pending)}
        {stat(labels.statNotAccepted, rejected, COLORS.rejected)}
      </View>
      <ProgressBar approved={approved} pending={pending} rejected={rejected} labels={labels} height={12} />
    </View>
  );
}

// ─── One collaborator ────────────────────────────────────────────

const STATE_KEY: Record<ContributorState, 'stateWaiting' | 'stateUpToDate' | 'stateNotStarted'> = {
  waiting: 'stateWaiting', up_to_date: 'stateUpToDate', not_started: 'stateNotStarted',
};

export function ContributorCard({ c, labels, onReview, onSeePhotos, onRemove }: {
  c: Contributor;
  labels: ProgressLabels;
  onReview: (id: string) => void;
  onSeePhotos: (id: string) => void;
  onRemove?: (c: Contributor) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const stateLabel = fill(labels[STATE_KEY[c.state]], { n: c.pending });
  const joined = c.joinedAt ? fill(labels.joinedAgo, { ago: timeAgo(c.joinedAt) }) : labels.noLongerCollaborator;
  const last = c.lastSubmittedAt ? fill(labels.lastPhoto, { ago: timeAgo(c.lastSubmittedAt) }) : labels.nothingSubmitted;
  const facts: string[] = [];
  if (c.approved > 0 && c.share !== null) facts.push(fill(labels.shareOfAlbum, { pct: c.share }));
  if (c.decided > 0 && c.acceptRate !== null) facts.push(fill(labels.acceptedRate, { pct: c.acceptRate }));
  const chip = c.state === 'waiting' ? styles.chipWaiting : c.state === 'up_to_date' ? styles.chipOk : styles.chipMuted;
  const chipText = c.state === 'waiting' ? styles.chipWaitingText : c.state === 'up_to_date' ? styles.chipOkText : styles.chipMutedText;
  return (
    <View style={styles.card} testID="contributor-card" accessibilityLabel={`${c.name}, ${stateLabel}`}>
      <PersonRow person={{ id: c.id, name: c.name, avatar: c.avatar ?? undefined }} size={44} caption={`${joined}, ${last}.`} />
      <View style={styles.chipRow}><View style={[styles.chip, chip]}><Text style={chipText}>{stateLabel}</Text></View></View>

      {c.state === 'not_started' ? (
        <Text style={styles.note}>{labels.notStartedNote}</Text>
      ) : (
        <>
          <ProgressBar approved={c.approved} pending={c.pending} rejected={c.rejected} labels={labels} />
          <Legend c={c} labels={labels} />
          {facts.length > 0 ? <Text style={styles.muted}>{facts.join('. ')}.</Text> : null}
        </>
      )}

      <View style={styles.actions}>
        {c.pending > 0 ? (
          <Button title={fill(labels.reviewTheirs, { n: c.pending })} onPress={() => onReview(c.id)} style={styles.action} />
        ) : null}
        {c.total > 0 ? (
          <Button title={fill(labels.allTheirs, { n: c.total })} variant="outline" onPress={() => onSeePhotos(c.id)} style={styles.action} />
        ) : null}
      </View>
      {onRemove && c.membershipId ? (
        <Pressable onPress={() => onRemove(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${labels.remove} ${c.name}`} style={styles.removeRow}>
          <Text style={[styles.remove, { color: colors.error }]}>{labels.remove}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── The list ────────────────────────────────────────────────────

export function ContributorList({ progress, labels, onReview, onSeePhotos, onRemove }: {
  progress: ProgressSummary;
  labels: ProgressLabels;
  onReview: (id: string) => void;
  onSeePhotos: (id: string) => void;
  onRemove: (c: Contributor) => void;
}) {
  const styles = useStyles();
  const { contributors, former } = progress;
  return (
    <View style={styles.list}>
      {contributors.map((c) => <ContributorCard key={c.id} c={c} labels={labels} onReview={onReview} onSeePhotos={onSeePhotos} onRemove={onRemove} />)}
      {former.length > 0 ? (
        <View style={styles.past} testID="former-contributors">
          <Text style={styles.pastTitle} accessibilityRole="header">{fill(labels.pastCollaborators, { n: former.length })}</Text>
          <Text style={styles.muted}>{labels.pastNote}</Text>
          {former.map((c) => <ContributorCard key={c.id} c={c} labels={labels} onReview={onReview} onSeePhotos={onSeePhotos} />)}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  list: { gap: spacing.md },
  card: { ...e(1), backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft, padding: spacing.lg, gap: spacing.md },
  cardTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  muted: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  note: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20, backgroundColor: c.surfaceMuted, borderRadius: radii.md, padding: spacing.md },
  bar: { flexDirection: 'row', overflow: 'hidden', backgroundColor: c.surfaceMuted },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: c.surfaceMuted, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  statValue: { color: c.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSmall: { width: 8, height: 8, borderRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: c.textMuted, fontSize: fontSize.sm },
  chipRow: { flexDirection: 'row' },
  chip: { borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  chipWaiting: { backgroundColor: 'rgba(242,12,143,0.12)' },
  chipOk: { backgroundColor: c.successBg },
  chipMuted: { backgroundColor: c.surfaceMuted },
  chipWaitingText: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  chipOkText: { color: c.success, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  chipMutedText: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  actions: { gap: spacing.sm },
  action: { alignSelf: 'stretch' },
  removeRow: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },
  remove: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  past: { gap: spacing.md, marginTop: spacing.sm },
  pastTitle: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
}));
