import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { confirmTvPairing } from '@/features/tv/api';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme, onFill } from '@/theme';

/** The TV's QR encodes {"code":"AB3K9Z"} — fall back to raw text as the code. */
function extractPairingCode(scanned: string): string {
  try {
    const parsed = JSON.parse(scanned) as { code?: string };
    if (parsed.code) return parsed.code;
  } catch {
    // Not JSON — treat the whole payload as the code.
  }
  return scanned;
}

function leaveScreen(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) router.back();
  else router.replace('/tv-devices' as Href);
}

export default function ConnectToTvScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useLanguage();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<'scanning' | 'connecting' | 'success' | 'error'>('scanning');
  const [message, setMessage] = useState<string | null>(null);
  const handledRef = useRef(false);

  const onScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setStatus('connecting');

      const pairingCode = extractPairingCode(result.data).trim().toUpperCase();
      try {
        await confirmTvPairing(pairingCode);
        setStatus('success');
        setTimeout(() => leaveScreen(router), 1200);
      } catch (err) {
        setStatus('error');
        setMessage(isApiError(err) ? err.message : t('b1_connectTvErr'));
      }
    },
    [router, t],
  );

  const tryAgain = () => {
    handledRef.current = false;
    setMessage(null);
    setStatus('scanning');
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => leaveScreen(router)}
          hitSlop={12}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('b1_connectTvCloseA11y')}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.title}>{t('b1_connectTvTitle')}</Text>
          <Text style={styles.subtitle}>{t('b1_connectTvSubtitle')}</Text>
        </View>
        <View style={styles.closeBtnSpacer} />
      </View>

      {!permission ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Text style={styles.body}>{t('b1_connectTvPermBody')}</Text>
          <Button title={t('b1_connectTvAllowCameraBtn')} onPress={requestPermission} />
          <Button title={t('b1_connectTvCancelBtn')} variant="ghost" onPress={() => leaveScreen(router)} />
        </View>
      ) : status === 'scanning' ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.frame} pointerEvents="none" />
          <Pressable
            style={({ pressed }) => [styles.cameraClose, pressed && styles.pressed]}
            onPress={() => leaveScreen(router)}
            accessibilityRole="button"
            accessibilityLabel={t('b1_connectTvCloseScannerA11y')}
          >
            <Ionicons name="close" size={20} color={onFill} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.center}>
          {status === 'connecting' ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.body}>{t('b1_connectTvConnecting')}</Text>
            </>
          ) : status === 'success' ? (
            <Text style={styles.successText}>{t('b1_connectTvSuccess')}</Text>
          ) : (
            <>
              <Text style={styles.errorText}>{message}</Text>
              <Button title={t('b1_connectTvScanAgainBtn')} onPress={tryAgain} />
              <Button title={t('b1_connectTvCancelBtn')} variant="ghost" onPress={() => leaveScreen(router)} />
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnSpacer: { width: 40, height: 40 },
  topCopy: { flex: 1, gap: 2, paddingTop: 6 },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  body: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center' },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  frame: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    right: '15%',
    bottom: '35%',
    borderWidth: 3,
    borderColor: c.accent,
    borderRadius: radii.xl,
  },
  cameraClose: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(15,18,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  successText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: c.success },
  errorText: { fontSize: fontSize.sm, color: c.error, textAlign: 'center' },
  pressed: { opacity: 0.75 },
}));
