import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { getKyc, openWebKycFlow } from '@/features/kyc/api';
import { ensureKycConsent } from '@/features/privacy/consent';
import { useAsync } from '@/hooks/useAsync';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';

/**
 * Identity verification.
 *
 * This screen used to collect the documents itself and POST them. It could
 * never succeed: it read status from a route with no handler (404 in production
 * logs, to real users) and posted a body that Spring rejected on the first
 * missing parameter. Zero submissions have ever come through it - all 27
 * verification rows in production carry browser user agents. See
 * features/kyc/api.ts for the full contract mismatch and why the fix is a
 * handoff rather than a native rebuild (CONN-ONB-1, CONN-ONB-9).
 *
 * It now shows where the account stands and hands verification to the web flow
 * in the in-app browser, the same pattern the paid flows already use. Status is
 * re-read whenever the screen regains focus, so returning from the browser
 * reflects a submission that just happened without needing a deep link back.
 */
export default function KycScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getKyc(), []));
  const [opening, setOpening] = useState(false);

  // The browser is a separate context with no way to notify us, so re-read on
  // return rather than trusting what we knew before leaving.
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const status = data?.status ?? 'NONE';
  const submitted = status === 'PENDING' || status === 'APPROVED';

  const openFlow = async () => {
    // Consent is still gathered here, before anything leaves the device.
    if (!(await ensureKycConsent())) return;
    setOpening(true);
    try {
      await openWebKycFlow();
    } finally {
      setOpening(false);
      void refresh();
    }
  };

  const copy = (() => {
    switch (status) {
      case 'APPROVED':
        return 'Your identity is verified. Withdrawals and the full set of features are unlocked.';
      case 'PENDING':
        return 'Your documents are with our review team. This usually takes a working day, and we will let you know as soon as it is decided.';
      case 'REJECTED':
        return 'Your last submission was not accepted. You can read why below and submit again.';
      default:
        return 'Verify your identity to unlock withdrawals and the full set of features. You will need a government ID and a few minutes.';
    }
  })();

  return (
    <Screen>
      <ScreenHeader title="Identity verification" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status</Text>
                <StatusPill status={status === 'NONE' ? 'Not submitted' : status} />
              </View>

              <Text style={styles.copy}>{copy}</Text>

              {data?.submittedAt ? (
                <Text style={styles.meta}>Submitted {data.submittedAt}</Text>
              ) : null}

              {data?.rejectionReason ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason</Text>
                  <Text style={styles.reason}>{data.rejectionReason}</Text>
                </View>
              ) : null}
            </View>

            {error ? (
              <Pressable onPress={() => void refresh()} style={styles.errorBox} accessibilityRole="button">
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>
                  We could not load your verification status. Tap to retry.
                </Text>
              </Pressable>
            ) : null}

            {status !== 'APPROVED' ? (
              <>
                <Pressable
                  onPress={openFlow}
                  disabled={opening}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: opening }}
                  style={({ pressed }) => [
                    styles.cta,
                    opening && styles.ctaDisabled,
                    pressed && !opening && styles.ctaPressed,
                  ]}
                >
                  {opening ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>
                        {submitted ? 'Review your submission' : 'Start verification'}
                      </Text>
                      <Ionicons name="open-outline" size={16} color={colors.textOnPrimary} />
                    </>
                  )}
                </Pressable>

                {/* Said plainly rather than discovered: the browser opening is
                    the expected behaviour, and the sign-in is a consequence of
                    it being a separate storage context, not a bug. */}
                <Text style={styles.note}>
                  Verification opens in your browser, where the camera and liveness
                  checks run. You may be asked to sign in again there.
                </Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  content: { paddingVertical: spacing.lg, gap: spacing.lg },
  centered: { paddingVertical: spacing['3xl'], alignItems: 'center' },

  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    ...e(1),
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.textMuted },
  copy: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.text, lineHeight: 21 },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.textMuted },

  reasonBox: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.tint,
  },
  reasonLabel: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: c.textMuted },
  reason: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.text, lineHeight: 20 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.error,
    backgroundColor: c.surface,
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.error },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaPressed: { opacity: 0.9 },
  ctaText: { fontFamily: fonts.bold, fontSize: fontSize.md, color: c.textOnPrimary },

  note: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
}));
