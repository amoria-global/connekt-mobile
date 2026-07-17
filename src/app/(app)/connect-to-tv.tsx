import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { confirmTvPairing } from '@/features/tv/api';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

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

export default function ConnectToTvScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<'scanning' | 'connecting' | 'success' | 'error'>('scanning');
  const [message, setMessage] = useState<string | null>(null);
  const handledRef = useRef(false);

  const onScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (handledRef.current) return;
    handledRef.current = true;
    setStatus('connecting');

    const pairingCode = extractPairingCode(result.data).trim().toUpperCase();
    try {
      await confirmTvPairing(pairingCode);
      setStatus('success');
      setTimeout(() => router.back(), 1200);
    } catch (err) {
      setStatus('error');
      setMessage(isApiError(err) ? err.message : 'Could not connect to that TV.');
    }
  }, [router]);

  const tryAgain = () => {
    handledRef.current = false;
    setMessage(null);
    setStatus('scanning');
  };

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title="Connect to TV" subtitle="Point your camera at the QR code on your TV" />

      {!permission ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Text style={styles.body}>Connekyt needs camera access to scan your TV's QR code.</Text>
          <Button title="Allow camera access" onPress={requestPermission} />
        </View>
      ) : status === 'scanning' ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.frame} pointerEvents="none" />
        </View>
      ) : (
        <View style={styles.center}>
          {status === 'connecting' ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.body}>Connecting to your TV…</Text>
            </>
          ) : status === 'success' ? (
            <Text style={styles.successText}>TV connected!</Text>
          ) : (
            <>
              <Text style={styles.errorText}>{message}</Text>
              <Button title="Scan again" onPress={tryAgain} />
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  body: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  frame: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    right: '15%',
    bottom: '35%',
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: radii.xl,
  },
  successText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.success },
  errorText: { fontSize: fontSize.sm, color: colors.error, textAlign: 'center' },
});
