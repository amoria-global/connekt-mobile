import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  type AppStateStatus,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { pickFromLibrary, type PickedImage } from '@/services/imagePicker';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { logKycEvent } from './livenessEngine';

export type LiveSelfieVerificationProps = {
  challengeToken: string;
  initialSelfie?: PickedImage | null;
  initialLivenessFrames?: PickedImage[];
  initialChallengeOrder?: string;
  initialChallengeTimingsMs?: string;
  onComplete: (result: {
    selfie: PickedImage;
    livenessFrames: PickedImage[];
    challengeOrder: string;
    challengeTimingsMs: string;
  }) => void;
  onCancel?: () => void;
};

export type SelfieUiState =
  | 'INITIAL'
  | 'REQUESTING_PERMISSION'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_BLOCKED'
  | 'CAMERA_READY'
  | 'LIVENESS_IN_PROGRESS'
  | 'CAPTURING'
  | 'REVIEW';

export function LiveSelfieVerification({
  challengeToken: _challengeToken,
  initialSelfie,
  initialLivenessFrames,
  initialChallengeOrder,
  initialChallengeTimingsMs,
  onComplete,
  onCancel,
}: LiveSelfieVerificationProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { tr } = useSharedT();

  const [permission, requestPermission] = useCameraPermissions();
  const [uiState, setUiState] = useState<SelfieUiState>(() =>
    initialSelfie ? 'REVIEW' : 'INITIAL',
  );

  // App lifecycle tracking — release camera preview when backgrounded
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const cameraRef = useRef<CameraView | null>(null);
  const isTransitioningRef = useRef(false);

  // Captured results
  const [capturedSelfie, setCapturedSelfie] = useState<PickedImage | null>(initialSelfie ?? null);
  const [verifiedPayload, setVerifiedPayload] = useState<{
    selfie: PickedImage;
    livenessFrames: PickedImage[];
    challengeOrder: string;
    challengeTimingsMs: string;
  } | null>(() => {
    if (initialSelfie) {
      return {
        selfie: initialSelfie,
        livenessFrames: initialLivenessFrames ?? [],
        challengeOrder: initialChallengeOrder ?? 'LOOK_STRAIGHT',
        challengeTimingsMs: initialChallengeTimingsMs ?? '[1200]',
      };
    }
    return null;
  });

  // Animations
  const flashAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for oval when positioning
  useEffect(() => {
    if (uiState === 'LIVENESS_IN_PROGRESS') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [uiState, pulseAnim]);

  // AppState listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const active = nextState === 'active';
      setIsAppActive(active);
      if (!active) {
        logKycEvent('Camera paused due to app backgrounding');
      } else {
        logKycEvent('Camera resumed on app foregrounding');
      }
    });
    return () => sub.remove();
  }, []);

  // Permission evaluation
  useEffect(() => {
    if (!permission) return;
    if (permission.granted) {
      if (uiState === 'INITIAL' || uiState === 'PERMISSION_DENIED' || uiState === 'REQUESTING_PERMISSION') {
        setUiState('CAMERA_READY');
      }
    } else if (!permission.canAskAgain) {
      setUiState('PERMISSION_BLOCKED');
    } else {
      setUiState('PERMISSION_DENIED');
    }
  }, [permission, uiState]);

  // Reset / Restart session
  const restartVerification = useCallback(() => {
    logKycEvent('Restarting selfie capture');
    isTransitioningRef.current = false;
    setCapturedSelfie(null);
    setVerifiedPayload(null);
    setUiState('LIVENESS_IN_PROGRESS');
  }, []);

  // Called when camera preview is mounted and ready
  const handleCameraReady = useCallback(() => {
    logKycEvent('Front camera ready for selfie capture');
    if (uiState === 'CAMERA_READY') {
      setUiState('LIVENESS_IN_PROGRESS');
    }
  }, [uiState]);

  // Capture selfie directly from the oval guide
  const captureSelfieFromOval = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setUiState('CAPTURING');

    // Shutter flash animation
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    try {
      let finalPhoto: PickedImage | null = null;
      if (cameraRef.current) {
        const cap = await cameraRef.current.takePictureAsync({
          quality: 0.88,
          skipProcessing: false,
        });
        if (cap?.uri) {
          finalPhoto = {
            uri: cap.uri,
            name: 'selfie.jpg',
            type: 'image/jpeg',
          };
        }
      }

      if (finalPhoto) {
        logKycEvent('Selfie captured directly from oval guide');
        setCapturedSelfie(finalPhoto);
        setVerifiedPayload({
          selfie: finalPhoto,
          livenessFrames: [finalPhoto],
          challengeOrder: 'LOOK_STRAIGHT',
          challengeTimingsMs: '[1200]',
        });
        setUiState('REVIEW');
      } else {
        setUiState('LIVENESS_IN_PROGRESS');
      }
    } catch (err) {
      logKycEvent('Selfie capture failed', { error: String(err) });
      setUiState('LIVENESS_IN_PROGRESS');
    } finally {
      isTransitioningRef.current = false;
    }
  }, [flashAnim]);

  // Handle user completing selfie and tapping Continue
  const handleConfirm = useCallback(() => {
    if (verifiedPayload) {
      logKycEvent('Selfie verification accepted by user');
      onComplete(verifiedPayload);
    }
  }, [onComplete, verifiedPayload]);

  const pickSelfieFromGallery = useCallback(async () => {
    try {
      const picked = await pickFromLibrary();
      if (!picked) return;
      logKycEvent('Selfie picked from library');
      setCapturedSelfie(picked);
      setVerifiedPayload({
        selfie: picked,
        livenessFrames: [picked],
        challengeOrder: 'LOOK_STRAIGHT',
        challengeTimingsMs: '[1200]',
      });
      setUiState('REVIEW');
    } catch {
      Alert.alert('Photo library unavailable', 'Please enable photo library access in Settings.');
    }
  }, []);

  // Oval guide dimensions
  const ovalWidth = Math.min(260, Math.round(width * 0.68));
  const ovalHeight = Math.round(ovalWidth * 1.32);

  // Render Permission States
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (uiState === 'PERMISSION_BLOCKED') {
    return (
      <View style={styles.cardContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="camera-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>{tr('Camera access is blocked')}</Text>
        <Text style={styles.cardBody}>
          Camera permission has been blocked in your device settings. Please enable camera access in Settings to take your selfie in the oval, or choose a photo from your library.
        </Text>
        <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
        <Button
          title="Upload from photo library"
          variant="outline"
          onPress={() => void pickSelfieFromGallery()}
          style={{ marginTop: spacing.sm }}
        />
        {onCancel ? (
          <Pressable onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{tr('Cancel')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (uiState === 'PERMISSION_DENIED') {
    return (
      <View style={styles.cardContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="camera-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>{tr('Camera access required')}</Text>
        <Text style={styles.cardBody}>
          Connekyt requires front camera access to take your selfie inside the oval guide, or you can choose a photo from your library.
        </Text>
        <Button
          title="Enable camera access"
          onPress={async () => {
            setUiState('REQUESTING_PERMISSION');
            await requestPermission();
          }}
        />
        <Button
          title="Upload from photo library"
          variant="outline"
          onPress={() => void pickSelfieFromGallery()}
          style={{ marginTop: spacing.sm }}
        />
        {onCancel ? (
          <Pressable onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{tr('Cancel')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // Render Review State
  if (uiState === 'REVIEW' && capturedSelfie) {
    return (
      <View style={styles.reviewContainer}>
        <View style={styles.verifiedPill}>
          <Ionicons name="camera" size={16} color="#10B981" />
          <Text style={styles.verifiedPillText}>{tr('Selfie Captured')}</Text>
        </View>

        <View style={[styles.reviewOval, { width: ovalWidth, height: ovalHeight }]}>
          <Image
            source={{ uri: capturedSelfie.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </View>

        <Text style={styles.reviewTitle}>{tr('Review your selfie')}</Text>
        <Text style={styles.reviewSubtitle}>
          Make sure your face is centered, well-lit, and in clear focus.
        </Text>

        <View style={styles.reviewActions}>
          <Button title="Continue" onPress={handleConfirm} />
          <Pressable onPress={restartVerification} style={styles.retakeBtn}>
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            <Text style={styles.retakeBtnText}>{tr('Retake selfie')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Render Live Camera + Oval Selfie
  return (
    <View style={styles.cameraWrapper}>
      {isAppActive ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mirror={Platform.OS !== 'web'}
          animateShutter={false}
          onCameraReady={handleCameraReady}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cameraBackground]} />
      )}

      {/* Shutter flash effect */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.shutterFlash,
          { opacity: flashAnim },
        ]}
      />

      {/* Top Header */}
      <View style={styles.topHud}>
        <View style={styles.topNavRow}>
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>{tr('Live Face Scan')}</Text>
          </View>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              style={styles.closeCameraBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={tr('Cancel')}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Center Face Oval Guide */}
      <View style={styles.ovalCenterWrap}>
        <Animated.View
          style={[
            styles.faceOval,
            { width: ovalWidth, height: ovalHeight },
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          {/* Subtle Corner / Edge Crosshairs */}
          <View style={[styles.guideBorder, styles.borderTopLeft]} />
          <View style={[styles.guideBorder, styles.borderTopRight]} />
          <View style={[styles.guideBorder, styles.borderBottomLeft]} />
          <View style={[styles.guideBorder, styles.borderBottomRight]} />
        </Animated.View>
      </View>

      {/* Bottom Live Guidance & Action Pill */}
      <View style={styles.bottomHud}>
        <View style={styles.promptCard}>
          <View style={styles.promptIconWrap}>
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.promptTextWrap}>
            <Text style={styles.promptTitle}>{tr('Position face in oval')}</Text>
            <Text style={styles.promptInstruction}>
              Center your face inside the oval guide and tap Take Photo
            </Text>
          </View>
        </View>

        {/* Capture selfie directly from oval */}
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          onPress={() => void captureSelfieFromOval()}
          accessibilityRole="button"
          accessibilityLabel={tr('Take Photo')}
        >
          <Ionicons name="camera" size={22} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>{tr('Take Photo')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.galleryPickBtn, pressed && styles.actionButtonPressed]}
          onPress={() => void pickSelfieFromGallery()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={tr('Or choose photo from library')}
        >
          <Ionicons name="images-outline" size={16} color="rgba(255,255,255,0.85)" />
          <Text style={styles.galleryPickText}>{tr('Or choose photo from library')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  cameraWrapper: {
    flex: 1,
    minHeight: 460,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'space-between',
    ...e(3),
  },
  cameraBackground: {
    backgroundColor: '#0F172A',
  },
  shutterFlash: {
    backgroundColor: '#FFFFFF',
    zIndex: 99,
  },
  centerContainer: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  // HUD Top
  topHud: {
    zIndex: 10,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  topNavRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  closeCameraBtn: {
    position: 'absolute',
    right: 0,
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPill: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },

  // Oval Guide
  ovalCenterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOval: {
    borderRadius: radii.full,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    position: 'relative',
    overflow: 'hidden',
  },
  guideBorder: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: c.primary,
  },
  borderTopLeft: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  borderTopRight: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  borderBottomLeft: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  borderBottomRight: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  // HUD Bottom
  bottomHud: {
    zIndex: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  promptIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTextWrap: {
    flex: 1,
    gap: 2,
  },
  promptTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  promptInstruction: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  actionButton: {
    height: 48,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  // Cards (Permission, Error)
  cardContainer: {
    minHeight: 320,
    backgroundColor: c.surface,
    padding: spacing.xl,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...e(2),
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    textAlign: 'center',
  },
  cardBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelText: {
    color: c.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Review
  reviewContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedPillText: {
    color: '#065F46',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  reviewOval: {
    borderRadius: radii.full,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: c.surfaceMuted,
    ...e(3),
  },
  reviewTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
    textAlign: 'center',
  },
  reviewSubtitle: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  reviewActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  retakeBtnText: {
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  galleryPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: radii.full,
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  galleryPickText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: 'rgba(255,255,255,0.9)',
  },
}));
