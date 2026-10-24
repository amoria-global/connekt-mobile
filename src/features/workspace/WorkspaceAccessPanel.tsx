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
  answerInvitation, cancelInvitation, getInvitePreview, leaveWorkspace, listReceivedInvitations, listSentInvitations,
  lookupPhotographer, resendInvitation, revokeMembership, sendInvitation, sendInvitationByEmail,
} from './api';
import { inviteFocus, ownerActionLabel, ownerMeaning, type InviteFocus, type InvitePreview } from './invite';
import {
  inviteeActions, ownerActions, shortDate, sortInvitations, statusView,
  type OwnerAction, type WorkspaceInvitation, type WorkspacePerson,
} from './model';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const message = (e: unknown, fallback: string) => (isApiError(e) && e.message ? e.message : fallback);

/**
 * `inviteId` is the id from an invitation link or pending sign-up: the matching invitation is put first, with a button
 * that accepts it and opens the workspace. `onInviteHandled` is called once it has been answered or dismissed, so the
 * screen can drop the id from its route.
 */
export function WorkspaceAccessPanel({ inviteId = null, onInviteHandled }: { inviteId?: string | null; onInviteHandled?: () => void } = {}) {
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
  // The public preview, asked only when the link's invitation is not one of this account's own.
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);

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

  const foundInReceived = !!inviteId && !!received && received.some((i) => i.id === inviteId);
  useEffect(() => {
    if (!inviteId || received === null || foundInReceived) return;
    let live = true;
    void getInvitePreview(inviteId).then((p) => { if (live) setPreview(p); });
    return () => { live = false; };
  }, [inviteId, received, foundInReceived]);

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

  const focus: InviteFocus | null = inviteId && (foundInReceived || preview !== undefined)
    ? inviteFocus(received, inviteId, preview ?? null)
    : null;
  const focusId = focus && (focus.kind === 'pending' || focus.kind === 'accepted' || focus.kind === 'ended') ? focus.invitation.id : null;
  // The linked invitation has its own card above, so it is not listed a second time.
  const listed = received.filter((i) => i.id !== focusId);
  const waitingForMe = sortInvitations(listed).filter((i) => i.status === 'PENDING');
  const joined = listed.filter((i) => i.status === 'ACCEPTED');

  const acceptAndOpen = async (inv: WorkspaceInvitation) => {
    if (working.current) return;
    working.current = true;
    setBusy(inv.id + 'accept');
    setNotice(null);
    try {
      await answerInvitation(inv.id, true);
      onInviteHandled?.();
      // Switching remounts the app inside the owner's workspace, so nothing after this needs to run.
      await switchTo(inv.owner.id);
    } catch (e) {
      setNotice({ kind: 'error', text: message(e, 'Something went wrong.') });
      void load();
    } finally {
      working.current = false;
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      {inviteId ? (
        focus ? (
          <InviteFocusCard focus={focus} busy={busy}
            onAcceptAndOpen={(inv) => { void acceptAndOpen(inv); }}
            onDecline={(inv) => { void run(inv.id + 'decline', async () => { await answerInvitation(inv.id, false); onInviteHandled?.(); }, 'Invitation declined.'); }}
            onOpen={(inv) => { onInviteHandled?.(); void switchTo(inv.owner.id); }}
            onDismiss={() => onInviteHandled?.()} />
        ) : (
          <View style={styles.centered} accessibilityLabel="Opening your invitation"><ActivityIndicator color={colors.primary} /></View>
        )
      ) : null}

      <View style={styles.explain}>
        <Ionicons name="people-circle-outline" size={26} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.explainTitle}>What they can and cannot do</Text>
          <Text style={styles.muted}>
            They can handle bookings, events, opportunities, albums and clients with you, and see your balance and analytics. They cannot withdraw, see transactions or change account settings, and they do not become you.
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
            message="Find a photographer by their email above. If they have an account they see the invitation in their app and get it by email. If not, we email them a link to create one." />
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
      if (found.registered === false) {
        const address = found.email || email.trim();
        await sendInvitationByEmail(address, note.trim() || undefined);
        setFound(null);
        setEmail('');
        setNote('');
        await onSent(`Invitation emailed to ${address}. They will need to create an account with that address first.`);
        return;
      }
      await sendInvitation(found.id, note.trim() || undefined);
      const name = found.name;
      setFound(null);
      setEmail('');
      setNote('');
      await onSent(`Invitation sent to ${name}. They will see it in their app and by email.`);
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
          {found.registered === false ? (
            <View style={styles.personRow}>
              <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="mail-outline" size={20} color={colors.primary} /></View>
              <View style={styles.flex}>
                <Text style={styles.name}>{found.email || email.trim()}</Text>
                <Text style={styles.muted}>
                  No account uses this address yet. We will email them a link. They create a photographer account with this exact address, then accept your invitation.
                </Text>
              </View>
            </View>
          ) : (
            <Person person={found} caption={found.customerType || 'Photographer'} />
          )}
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
          <Button title={found.registered === false ? 'Email invitation' : 'Send invitation'} onPress={send} loading={sending} disabled={sending} />
        </View>
      ) : null}
    </View>
  );
}

// ─── The invitation a link points at ─────────────────────────────

function InviteFocusCard({ focus, busy, onAcceptAndOpen, onDecline, onOpen, onDismiss }: {
  focus: InviteFocus; busy: string | null;
  onAcceptAndOpen: (inv: WorkspaceInvitation) => void; onDecline: (inv: WorkspaceInvitation) => void;
  onOpen: (inv: WorkspaceInvitation) => void; onDismiss: () => void;
}) {
  const styles = useStyles();
  if (focus.kind === 'pending') {
    const inv = focus.invitation;
    return (
      <View style={[styles.focusCard, styles.focusPending]} accessibilityLabel="Your invitation" testID="invite-focus">
        <Text style={styles.focusEyebrow}>YOUR INVITATION</Text>
        <Person person={inv.owner} />
        <Text style={styles.focusTitle}>{inv.owner.name} invited you to work in their workspace</Text>
        <Text style={styles.muted}>
          You would handle bookings, events, albums and clients with them, and see their balance and analytics. Withdrawals and transactions stay with them, and your own account stays separate.
        </Text>
        <View style={styles.actions}>
          <Button title="Accept and open workspace" loading={busy === inv.id + 'accept'} disabled={busy !== null} onPress={() => onAcceptAndOpen(inv)} style={styles.flex} />
          <Button title="Decline" variant="ghost" loading={busy === inv.id + 'decline'} disabled={busy !== null} onPress={() => onDecline(inv)} style={styles.flex} />
        </View>
      </View>
    );
  }
  if (focus.kind === 'accepted') {
    const inv = focus.invitation;
    return (
      <View style={[styles.focusCard, styles.focusOk]} accessibilityLabel="Your invitation" testID="invite-focus">
        <Text style={styles.focusTitle}>You already work in {inv.owner.name}&apos;s workspace</Text>
        <View style={styles.actions}>
          <Button title="Open workspace" onPress={() => onOpen(inv)} style={styles.flex} />
          <Button title="Dismiss" variant="ghost" onPress={onDismiss} style={styles.flex} />
        </View>
      </View>
    );
  }
  const text = focus.kind === 'ended'
    ? `This invitation from ${focus.invitation.owner.name} is ${focus.label}. Ask them to send a new one if you still want to work together.`
    : focus.kind === 'mismatch'
      ? `This invitation was sent to ${focus.maskedEmail}, which is not the account you are signed in with. Sign out, then sign in or create an account with that address to accept it.`
      : focus.kind === 'closed'
        ? 'This invitation is no longer open. It may have been answered, cancelled or expired. Ask the photographer to send a new one.'
        : 'We could not open this invitation. Check your connection, and that you are signed in with the address it was sent to.';
  return (
    <View accessibilityRole="alert" style={[styles.focusCard, styles.focusWarn]} accessibilityLabel="Your invitation" testID="invite-focus">
      <Text style={styles.focusWarnText}>{text}</Text>
      <Button title="Dismiss" variant="ghost" onPress={onDismiss} />
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
      <View style={styles.statusLine}>
        <StatusBadge inv={inv} />
        {inv.invitee.registered === false ? <View style={[styles.badge, styles.badgeMuted]}><Text style={styles.badgeTextMuted}>No account yet</Text></View> : null}
      </View>
      <Text style={styles.muted}>{ownerMeaning(inv)} {when}</Text>
      {inv.note ? <Text style={styles.note}>&ldquo;{inv.note}&rdquo;</Text> : null}
      <View style={styles.actions}>
        {ownerActions(inv.status).map((a) => (
          <Button key={a} title={ownerActionLabel(a, inv)} variant={a === 'resend' ? 'outline' : 'ghost'} loading={busy === inv.id + a}
            disabled={busy !== null} accessibilityLabel={`${ownerActionLabel(a, inv)}: ${inv.invitee.name}`} onPress={() => onAction(a)} style={styles.flex} />
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
          ? `${inv.owner.name} invited you to work in their workspace. You would handle bookings, events, albums and clients, and see their balance and analytics. Withdrawals and transactions stay with them.`
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
  statusLine: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  focusCard: { borderRadius: radii.lg, borderWidth: 2, padding: spacing.lg, gap: spacing.sm },
  focusPending: { borderColor: c.primary, backgroundColor: c.tint },
  focusOk: { borderColor: c.success, backgroundColor: c.surface },
  focusWarn: { borderColor: c.warning, backgroundColor: c.surface },
  focusEyebrow: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  focusTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  focusWarnText: { color: c.text, fontSize: fontSize.sm, lineHeight: 20 },
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
