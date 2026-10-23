/**
 * Says why the person is on a sign-in or sign-up screen when they came from a workspace invitation: who invited them
 * and which email to use. A status for the good cases and an alert when the invited address cannot take the invitation.
 */
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { fontSize, fontWeight, radii, spacing, makeStyles } from '@/theme';
import type { InvitePlan } from './invite';

export function InviteNotice({ plan }: { plan: InvitePlan }) {
  const styles = useStyles();
  const tone = plan.notice.tone;
  const icon = tone === 'error' ? 'alert-circle-outline' : tone === 'warn' ? 'information-circle-outline' : 'people-circle-outline';
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      testID="workspace-invite-notice"
      style={[styles.box, tone === 'error' ? styles.error : tone === 'warn' ? styles.warn : styles.info]}
    >
      <Ionicons name={icon} size={20} color={tone === 'error' ? '#991B1B' : tone === 'warn' ? '#92400E' : '#083A85'} />
      <Text style={[styles.text, tone === 'error' ? styles.errorText : tone === 'warn' ? styles.warnText : styles.infoText]}>{plan.notice.text}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  info: { backgroundColor: '#EEF2F9', borderColor: '#C3D1EA' },
  warn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  error: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  text: { flex: 1, fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.semibold },
  infoText: { color: '#083A85' },
  warnText: { color: '#92400E' },
  errorText: { color: '#991B1B' },
}));
