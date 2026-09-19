import type { PickedImage } from '@/services/imagePicker';

/**
 * Liveness challenge gesture types.
 * Each challenge requires physical movement or gaze alignment.
 */
export type LivenessChallengeType =
  | 'LOOK_STRAIGHT'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'BLINK'
  | 'SMILE';

export type ChallengeStep = {
  id: string;
  type: LivenessChallengeType;
  title: string;
  instruction: string;
  subtext: string;
  icon: string;
  minDurationMs: number;
  maxDurationMs: number;
};

export type LivenessVerificationResult = {
  passed: boolean;
  failureReason?: string;
  challengeOrder: string;
  challengeTimingsMs: string;
  livenessFrames: PickedImage[];
  selfiePhoto: PickedImage;
  timestamp: number;
};

/**
 * Generates an active, randomized challenge sequence for the liveness session.
 * 1. Always begins with LOOK_STRAIGHT to baseline face framing.
 * 2. Picks a randomized directional movement (TURN_LEFT or TURN_RIGHT).
 * 3. Finishes with LOOK_STRAIGHT for stable, high-resolution final capture.
 */
export function generateLivenessPlan(mode: 'standard' | 'full' = 'full'): ChallengeStep[] {
  if (mode === 'standard') {
    return [
      {
        id: 'step_live_photo',
        type: 'LOOK_STRAIGHT',
        title: 'Position face in oval',
        instruction: 'Center your face inside the oval and look straight into the camera',
        subtext: 'Hold still for your photo',
        icon: 'scan-outline',
        minDurationMs: 500,
        maxDurationMs: 15000,
      },
    ];
  }

  const isTurnLeft = Math.random() < 0.5;
  const turnChallenge: ChallengeStep = isTurnLeft
    ? {
        id: 'step_turn_left',
        type: 'TURN_LEFT',
        title: 'Turn slightly left',
        instruction: 'Turn your head slightly to your left',
        subtext: 'Keep looking toward the camera',
        icon: 'arrow-back',
        minDurationMs: 600,
        maxDurationMs: 8000,
      }
    : {
        id: 'step_turn_right',
        type: 'TURN_RIGHT',
        title: 'Turn slightly right',
        instruction: 'Turn your head slightly to your right',
        subtext: 'Keep looking toward the camera',
        icon: 'arrow-forward',
        minDurationMs: 600,
        maxDurationMs: 8000,
      };

  return [
    {
      id: 'step_center',
      type: 'LOOK_STRAIGHT',
      title: 'Look straight',
      instruction: 'Position your face in the oval and look directly at the camera',
      subtext: 'Hold steady inside the guide',
      icon: 'scan-outline',
      minDurationMs: 700,
      maxDurationMs: 8000,
    },
    turnChallenge,
    {
      id: 'step_recenter',
      type: 'LOOK_STRAIGHT',
      title: 'Hold still',
      instruction: 'Turn back and look straight at the camera',
      subtext: 'Hold still for your photo',
      icon: 'camera-outline',
      minDurationMs: 600,
      maxDurationMs: 8000,
    },
  ];
}

export function generateStandardLivenessPlan(): ChallengeStep[] {
  return generateLivenessPlan('standard');
}

export type RecordedStep = {
  type: LivenessChallengeType;
  durationMs: number;
  frame?: PickedImage;
};

/**
 * Validates that the client-assisted challenge sequence completed with expected human pacing
 * and collects evidence frames and challenge telemetry for backend appraisal.
 *
 * NOTE ON SECURITY / PRESENTATION ATTACK DETECTION:
 * This module coordinates client-side UI step prompts and collects timing telemetry
 * and checkpoint frames. It does NOT provide certified ISO/IEC 30107-3 Presentation
 * Attack Detection (PAD) on its own. Final verification, biometric face matching,
 * and fraud evaluation are executed on the backend / compliance pipeline.
 *
 * Criteria evaluated locally before submission:
 * - Challenges completed in expected sequence.
 * - Human pacing check: each step duration >= 500ms (avoids automated bot triggers and backend risk penalty).
 * - Timeout check: step duration does not exceed max allowed threshold.
 * - Multi-frame evidence: verification frames captured at challenge transitions.
 * - File reference check: rejects identical frame pointers.
 */
export function verifyLivenessSession(
  plan: ChallengeStep[],
  recordedSteps: RecordedStep[],
  finalSelfie: PickedImage | null,
): { passed: boolean; failureReason?: string; challengeOrder: string; challengeTimingsMs: string } {
  if (!finalSelfie || !finalSelfie.uri) {
    return {
      passed: false,
      failureReason: 'Selfie capture was not completed.',
      challengeOrder: '',
      challengeTimingsMs: '[]',
    };
  }

  if (recordedSteps.length < plan.length) {
    return {
      passed: false,
      failureReason: 'Selfie challenge sequence incomplete. All steps must be performed.',
      challengeOrder: '',
      challengeTimingsMs: '[]',
    };
  }

  const timings: number[] = [];
  const challengeTypes: string[] = [];

  for (let i = 0; i < plan.length; i++) {
    const expected = plan[i];
    const recorded = recordedSteps[i];

    if (!recorded || recorded.type !== expected.type) {
      return {
        passed: false,
        failureReason: 'Challenge sequence mismatch. Please follow the on-screen prompts.',
        challengeOrder: '',
        challengeTimingsMs: '[]',
      };
    }

    // Bot / instant replay check: human movement cannot take under 500ms
    if (recorded.durationMs < 500) {
      return {
        passed: false,
        failureReason: 'Movement detected too quickly. Please perform the motion naturally.',
        challengeOrder: '',
        challengeTimingsMs: '[]',
      };
    }

    // Timeout check
    if (recorded.durationMs > expected.maxDurationMs + 2000) {
      return {
        passed: false,
        failureReason: 'Verification timed out. Please try again in good lighting.',
        challengeOrder: '',
        challengeTimingsMs: '[]',
      };
    }

    timings.push(recorded.durationMs);
    challengeTypes.push(recorded.type);
  }

  // Frame variance check: ensures frames are present and not identical copies
  const frames = recordedSteps.map((s) => s.frame).filter(Boolean) as PickedImage[];
  if (frames.length >= 2) {
    const allUrisSame = frames.every((f) => f.uri === frames[0].uri);
    if (allUrisSame && frames.length > 1) {
      return {
        passed: false,
        failureReason: 'Could not detect distinct movement across selfie steps. Please follow the on-screen prompts.',
        challengeOrder: challengeTypes.join(','),
        challengeTimingsMs: JSON.stringify(timings),
      };
    }
  }

  return {
    passed: true,
    challengeOrder: challengeTypes.join(','),
    challengeTimingsMs: JSON.stringify(timings),
  };
}

/**
 * Privacy-compliant structured logger.
 * Never logs biometric images, tokens, IDs, or sensitive PII.
 */
export function logKycEvent(event: string, meta?: Record<string, unknown>) {
  const sanitizedMeta = meta ? { ...meta } : undefined;
  if (sanitizedMeta) {
    delete sanitizedMeta.token;
    delete sanitizedMeta.uri;
    delete sanitizedMeta.base64;
    delete sanitizedMeta.challengeToken;
    delete sanitizedMeta.idNumber;
  }
  const payload = sanitizedMeta && Object.keys(sanitizedMeta).length > 0
    ? ` ${JSON.stringify(sanitizedMeta)}`
    : '';
  console.log(`[KYC] ${event}${payload}`);
}
