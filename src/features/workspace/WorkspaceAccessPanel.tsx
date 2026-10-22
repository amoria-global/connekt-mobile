/**
 * Workspace access, inside Collaborate. Mirrors the dashboard's "Workspace access" tab.
 *
 * Separate from album collaboration on purpose: an album collaborator only submits photos to one album, while a
 * photographer invited here works inside the whole workspace (bookings, events, albums, clients) but never sees the
 * wallet, payments or account settings. The panel says so plainly.
 *
 * Two sides of one list: invitations this photographer sent, and invitations sent to them. The server decides what is
 * legal; the buttons shown are only the ones that can work for the status.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { isApiError } from '@/store/auth';
import { useWorkspace } from '@/store/workspace';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme } from '@/theme';
import {
  answerInvitation, cancelInvitation, leaveWorkspace, listReceivedInvitations, listSentInvitations,
  lookupPhotographer, resendInvitation, revokeMembership, sendInvitation,
} from './api';
import {
  inviteeActions, ownerActions, shortDate, sortInvitations, statusView,
  type OwnerAction, type WorkspaceInvitation, type WorkspacePerson,
} from './model';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const ACTION_LABEL: Record<OwnerAction, string> = { resend: 'Send again', cancel: 'Cancel', revoke: 'Remove access' };

const message = (e: unknown, fallback: string) => (isApiError(e) && e.message ? e.message : fallback);

export function WorkspaceAccessPanel() {
  const styles = useStyles();
  const { colors } = useTheme();
  const switchTo = useWorkspace((s) => s.switchTo);
  const refreshWorkspaces = useWorkspace((s) => s.refresh);

  const [sent, setSent] = useState<WorkspaceInvitation[] | null>(null);
  const [received, setReceived] = useState<WorkspaceInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // A ref as well as state: two quick taps in one render must still make one request.
  const working = useRef(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([listSentInvitations(), listReceivedInvitations()]);
      setSent(s);
      setReceived(r);
      setError(null);
    } catch (e) {
      setError(message(e, 'Could not load invitations.'));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** One request at a time; a second tap while it runs does nothing. */
  const run = async (key: string, work: () => Promise<unknown>, success: string) => {
    if (working.current) return;
    working.current = true;
    setBusy(key);
    setNotice(null);
    try {
      await work();
      setNotice({ kind: 'ok', text: success });
      await load();
      void refreshWorkspaces();
    } catch (e) {
      setNotice({ kind: 'error', text: message(e, 'Something went wrong.') });
      // The server may have moved the invitation on (answered or cancelled elsewhere): show what is true now.
      void load();
    } finally {
      working.current = false;
      setBusy(null);
    }
  };

  const ownerAction = (a: OwnerAction, inv: WorkspaceInvitation) => {
    const go = () => {
      if (a === 'resend') return run(inv.id + a, () => resendInvitation(inv.id), 'Invitation sent again.');
      if (a === 'cancel') return run(inv.id + a, () => cancelInvitation(inv.id), 'Invitation cancelled.');
      return run(inv.id + a, () => revokeMembership(inv.id), `${inv.invitee.name} no longer has access.`);
    };
    if (a === 'resend') {
      void go();
      return;
    }
    Alert.alert(
      a === 'revoke' ? 'Remove access?' : 'Cancel this invitation?',
      a === 'revoke'
        ? `${inv.invitee.name} will lose access to your workspace right away. You can invite them again later.`
        : `${inv.invitee.name} will no longer be able to accept this invitation.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: a === 'revoke' ? 'Remove access' : 'Cancel invitation', style: 'destructive', onPress: () => { void go(); } },
      ],
    );
  };

  const leave = (inv: WorkspaceInvitation) => {
    Alert.alert('Leave this workspace?', `You will stop working in ${inv.owner.name}'s workspace. They can invite you again.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { void run(inv.id + 'leave', () => leaveWorkspace(inv.id), 'You left the workspace.'); } },
    ]);
  };

  if (error) {
    return <EmptyState icon="cloud-offline-outline" title="Could not load invitations" message={error} action={{ label: 'Try again', onPress: load }} />;
  }
  if (!sent || !received) {
    return <View style={styles.centered} accessibilityLabel="Loading invitations"><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const waitingForMe = sortInvitations(received).filter((i) => i.status === 'PENDING');
  const joined = received.filter((i) => i.status === 'ACCEPTED');

  return (
    <View style={styles.wrap}>
      <View style={styles.explain}>
        <Ionicons name="people-circle-outline" size={26} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.explainTitle}>Let another photographer work in your workspace</Text>
          <Text style={styles.muted}>
            They sign in with their own account and switch into your workspace. They can handle bookings, events, albums and clients
            with you. They cannot see your wallet, payments or account settings, and they do not become you.
          </Text>
        </View>
      </View>

      {notice ? (
        <View accessibilityLiveRegion="polite" accessibilityRole={notice.kind === 'error' ? 'alert' : undefined}
          style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]}>
          <Text style={notice.kind === 'error' ? styles.noticeErrorText : styles.noticeOkText}>{notice.text}</Text>
        </View>
      ) : null}

      {waitingForMe.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Invitations for you</Text>
          {waitingForMe.map((inv) => (
            <ReceivedRow key={inv.id} inv={inv} busy={busy}
              onAccept={() => run(inv.id + 'accept', () => answerInvitation(inv.id, true), `You joined ${inv.owner.name}'s workspace.`)}
              onDecline={() => run(inv.id + 'decline', () => answerInvitation(inv.id, false), 'Invitation declined.')}
              onOpen={() => { void switchTo(inv.owner.id); }} onLeave={() => leave(inv)} />
          ))}
        </View>
      ) : null}

      {joined.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Workspaces you can open</Text>
          {joined.map((inv) => (
            <ReceivedRow key={inv.id} inv={inv} busy={busy} onAccept={() => {}} onDecline={() => {}}
              onOpen={() => { void switchTo(inv.owner.id); }} onLeave={() => leave(inv)} />
          ))}
        </View>
      ) : null}

      <InviteForm onSent={async (text) => { setNotice({ kind: 'ok', text }); await load(); }} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">Invitations you sent</Text>
        {sent.length === 0 ? (
          <EmptyState icon="send-outline" title="You have not invited anyone yet"
            message="Find a photographer by their email above. They will see the invitation in their app." />
        ) : (
          sortInvitations(sent).map((inv) => <SentRow key={inv.id} inv={inv} busy={busy} onAction={(a) => ownerAction(a, inv)} />)
        )}
      </View>
    </View>
  );
}

// ─── Invite form ─────────────────────────────────────────────────

function InviteForm({ onSent }: { onSent: (text: string) => Promise<void> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<WorkspacePerson | null>(null);
  const [note, setNote] = useState('');
  const [looking, setLooking] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inFlight = useRef(false);

  const find = async () => {
    if (inFlight.current || !email.trim()) return;
    inFlight.current = true;
    setLooking(true);
    setProblem(null);
    setFound(null);
    try {
      setFound(await lookupPhotographer(email));
    } catch (e) {
      setProblem(message(e, 'Could not look that up.'));
    } finally {
      inFlight.current = false;
      setLooking(false);
    }
  };

  const send = async () => {
    if (!found || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setProblem(null);
    try {
      await sendInvitation(found.id, note.trim() || undefined);
      const name = found.name;
      setFound(null);
      setEmail('');
      setNote('');
      await onSent(`Invitation sent to ${name}. They will see it in their app.`);
    } catch (e) {
      setProblem(message(e, 'Could not send the invitation.'));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} accessibilityRole="header">Invite a photographer</Text>
      <Text style={styles.label}>Their email</Text>
      <TextInput
        value={email}
        onChangeText={(t) => { setEmail(t); setFound(null); setProblem(null); }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="name@example.com"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        onSubmitEditing={find}
        returnKeyType="search"
        accessibilityLabel="Their email"
      />
      <Button title="Find photographer" variant="outline" onPress={find} loading={looking} disabled={looking || !email.trim()} />

      {problem ? <Text accessibilityRole="alert" style={styles.problem}>{problem}</Text> : null}

      {found ? (
        <View style={styles.found}>
          <Person person={found} caption={found.customerType || 'Photographer'} />
          <Text style={styles.label}>Add a note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={255}
            placeholder="For example: help me with weddings this season"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Add a note (optional)"
          />
          <Button title="Send invitation" onPress={send} loading={sending} disabled={sending} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Rows ────────────────────────────────────────────────────────

function Person({ person, caption }: { person: WorkspacePerson; caption?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.personRow}>
      {person.profilePicture ? (
        <Image source={{ uri: person.profilePicture }} style={styles.avatar} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarLetter}>{person.name.slice(0, 1).toUpperCase()}</Text></View>
      )}
      <View style={styles.flex}>
        <Text style={styles.name}>{person.name}</Text>
        {caption ? <Text style={styles.muted}>{caption}</Text> : null}
      </View>
    </View>
  );
}

function StatusBadge({ inv }: { inv: WorkspaceInvitation }) {
  const styles = useStyles();
  const v = statusView(inv.status);
  const tone = v.tone === 'success' ? styles.badgeSuccess : v.tone === 'warning' ? styles.badgeWarning : v.tone === 'error' ? styles.badgeError : styles.badgeMuted;
  const text = v.tone === 'success' ? styles.badgeTextSuccess : v.tone === 'warning' ? styles.badgeTextWarning : v.tone === 'error' ? styles.badgeTextError : styles.badgeTextMuted;
  return <View style={[styles.badge, tone]}><Text style={text}>{v.label}</Text></View>;
}

function SentRow({ inv, busy, onAction }: { inv: WorkspaceInvitation; busy: string | null; onAction: (a: OwnerAction) => void }) {
  const styles = useStyles();
  const v = statusView(inv.status);
  const when = inv.status === 'PENDING' ? `Sent ${shortDate(inv.createdAt)}. Expires ${shortDate(inv.expiresAt)}.` : `Sent ${shortDate(inv.createdAt)}.`;
  return (
    <View style={styles.card} accessibilityLabel={`${inv.invitee.name}, ${v.label}`}>
      <Person person={inv.invitee} />
      <View style={styles.statusLine}><StatusBadge inv={inv} /></View>
      <Text style={styles.muted}>{v.meaning.owner} {when}</Text>
      {inv.note ? <Text style={styles.note}>&ldquo;{inv.note}&rdquo;</Text> : null}
      <View style={styles.actions}>
        {ownerActions(inv.status).map((a) => (
          <Button key={a} title={ACTION_LABEL[a]} variant={a === 'resend' ? 'outline' : 'ghost'} loading={busy === inv.id + a}
            disabled={busy !== null} accessibilityLabel={`${ACTION_LABEL[a]}: ${inv.invitee.name}`} onPress={() => onAction(a)} style={styles.flex} />
        ))}
      </View>
    </View>
  );
}

function ReceivedRow({ inv, busy, onAccept, onDecline, onOpen, onLeave }: {
  inv: WorkspaceInvitation; busy: string | null; onAccept: () => void; onDecline: () => void; onOpen: () => void; onLeave: () => void;
}) {
  const styles = useStyles();
  const v = statusView(inv.status);
  const actions = inviteeActions(inv.status);
  return (
    <View style={styles.card} accessibilityLabel={`${inv.owner.name}'s workspace, ${v.label}`}>
      <Person person={inv.owner} caption={`${inv.owner.name}'s workspace`} />
      <View style={styles.statusLine}><StatusBadge inv={inv} /></View>
      <Text style={styles.muted}>
        {inv.status === 'PENDING'
          ? `${inv.owner.name} invited you to work in their workspace. You would handle bookings, events, albums and clients. Wallet and payments stay with them.`
          : v.meaning.invitee}
      </Text>
      <View style={styles.actions}>
        {actions.includes('accept') ? <Button title="Accept" loading={busy === inv.id + 'accept'} disabled={busy !== null} onPress={onAccept} style={styles.flex} /> : null}
        {actions.includes('decline') ? <Button title="Decline" variant="ghost" loading={busy === inv.id + 'decline'} disabled={busy !== null} onPress={onDecline} style={styles.flex} /> : null}
        {actions.includes('open') ? <Button title="Open workspace" disabled={busy !== null} onPress={onOpen} style={styles.flex} /> : null}
        {actions.includes('leave') ? <Button title="Leave" variant="ghost" disabled={busy !== null} onPress={onLeave} style={styles.flex} /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  wrap: { gap: spacing.lg },
  centered: { paddingVertical: spacing['3xl'], alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, flexShrink: 1 },
  section: { gap: spacing.md },
  sectionTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  explain: {
    flexDirection: 'row', gap: spacing.md, backgroundColor: c.tint, borderRadius: radii.lg, padding: spacing.lg,
  },
  explainTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  muted: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  notice: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  noticeOk: { borderColor: c.success, backgroundColor: c.surface },
  noticeError: { borderColor: c.error, backgroundColor: c.surface },
  noticeOkText: { color: c.success, fontSize: fontSize.sm },
  noticeErrorText: { color: c.error, fontSize: fontSize.sm },
  card: { ...e(1), backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft, padding: spacing.lg, gap: spacing.sm },
  label: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: radii.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, color: c.text, fontSize: fontSize.sm, backgroundColor: c.surface, minHeight: 48,
  },
  problem: { color: c.error, fontSize: fontSize.sm },
  found: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: spacing.md },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: c.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  name: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  statusLine: { flexDirection: 'row' },
  badge: { borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  badgeSuccess: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.success },
  badgeWarning: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.warning },
  badgeError: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.error },
  badgeMuted: { backgroundColor: c.surfaceMuted },
  badgeTextSuccess: { color: c.success, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  badgeTextWarning: { color: c.warning, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  badgeTextError: { color: c.error, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  badgeTextMuted: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  note: { color: c.textMuted, fontSize: fontSize.sm, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
}));
