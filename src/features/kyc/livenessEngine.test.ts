import {
  generateLivenessPlan,
  verifyLivenessSession,
  logKycEvent,
  type RecordedStep,
} from './livenessEngine';
import type { PickedImage } from '@/services/imagePicker';

describe('livenessEngine', () => {
  describe('generateLivenessPlan', () => {
    it('creates a 3-step challenge plan starting and ending with LOOK_STRAIGHT', () => {
      const plan = generateLivenessPlan();
      expect(plan).toHaveLength(3);
      expect(plan[0].type).toBe('LOOK_STRAIGHT');
      expect(['TURN_LEFT', 'TURN_RIGHT']).toContain(plan[1].type);
      expect(plan[2].type).toBe('LOOK_STRAIGHT');
    });

    it('specifies minimum and maximum durations per challenge', () => {
      const plan = generateLivenessPlan();
      for (const step of plan) {
        expect(step.minDurationMs).toBeGreaterThanOrEqual(500);
        expect(step.maxDurationMs).toBeGreaterThan(step.minDurationMs);
      }
    });
  });

  describe('verifyLivenessSession', () => {
    const mockSelfie: PickedImage = {
      uri: 'file:///cache/final_selfie.jpg',
      name: 'selfie.jpg',
      type: 'image/jpeg',
    };

    it('fails when final selfie is missing', () => {
      const plan = generateLivenessPlan();
      const result = verifyLivenessSession(plan, [], null);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('Selfie capture was not completed');
    });

    it('fails when steps are incomplete', () => {
      const plan = generateLivenessPlan();
      const recorded: RecordedStep[] = [
        { type: plan[0].type, durationMs: 1200 },
      ];
      const result = verifyLivenessSession(plan, recorded, mockSelfie);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('incomplete');
    });

    it('fails when challenge sequence does not match plan', () => {
      const plan = generateLivenessPlan();
      const recorded: RecordedStep[] = [
        { type: 'BLINK', durationMs: 1000 },
        { type: 'TURN_LEFT', durationMs: 1200 },
        { type: 'LOOK_STRAIGHT', durationMs: 1100 },
      ];
      const result = verifyLivenessSession(plan, recorded, mockSelfie);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('sequence mismatch');
    });

    it('fails when step is suspiciously fast (< 500ms, bot detection)', () => {
      const plan = generateLivenessPlan();
      const recorded: RecordedStep[] = [
        { type: plan[0].type, durationMs: 1200 },
        { type: plan[1].type, durationMs: 250 }, // Too fast!
        { type: plan[2].type, durationMs: 1100 },
      ];
      const result = verifyLivenessSession(plan, recorded, mockSelfie);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('too quickly');
    });

    it('fails when step times out', () => {
      const plan = generateLivenessPlan();
      const recorded: RecordedStep[] = [
        { type: plan[0].type, durationMs: 1200 },
        { type: plan[1].type, durationMs: 15000 }, // Timeout
        { type: plan[2].type, durationMs: 1100 },
      ];
      const result = verifyLivenessSession(plan, recorded, mockSelfie);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('timed out');
    });

    it('fails when all frames have the exact same URI (static photo spoof attack)', () => {
      const plan = generateLivenessPlan();
      const staticFrame: PickedImage = {
        uri: 'file:///same_photo.jpg',
        name: 'same_photo.jpg',
        type: 'image/jpeg',
      };
      const recorded: RecordedStep[] = [
        { type: plan[0].type, durationMs: 1200, frame: staticFrame },
        { type: plan[1].type, durationMs: 1500, frame: staticFrame },
        { type: plan[2].type, durationMs: 1100, frame: staticFrame },
      ];
      const result = verifyLivenessSession(plan, recorded, mockSelfie);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('Could not detect distinct movement');
    });

    it('passes and outputs valid challenge metadata on legitimate execution', () => {
      const plan = generateLivenessPlan();
      const recorded: RecordedStep[] = [
        {
          type: plan[0].type,
          durationMs: 1100,
          frame: { uri: 'file:///frame_0.jpg', name: 'frame_0.jpg', type: 'image/jpeg' },
        },
        {
          type: plan[1].type,
          durationMs: 1650,
          frame: { uri: 'file:///frame_1.jpg', name: 'frame_1.jpg', type: 'image/jpeg' },
        },
        {
          type: plan[2].type,
          durationMs: 1200,
          frame: { uri: 'file:///frame_2.jpg', name: 'frame_2.jpg', type: 'image/jpeg' },
        },
      ];
      const result = verifyLivenessSession(plan, recorded, mockSelfie);
      expect(result.passed).toBe(true);
      expect(result.challengeOrder).toBe(plan.map((p) => p.type).join(','));
      expect(result.challengeTimingsMs).toBe('[1100,1650,1200]');
      expect(JSON.parse(result.challengeTimingsMs)).toEqual([1100, 1650, 1200]);
    });
  });

  describe('logKycEvent', () => {
    it('strips sensitive PII and tokens before logging', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logKycEvent('Selfie verification started', {
        step: 2,
        token: 'secret_token',
        uri: 'file:///private.jpg',
        challengeToken: 'sensitive_jwt',
      });

      expect(spy).toHaveBeenCalledTimes(1);
      const logged = spy.mock.calls[0][0];
      expect(logged).toContain('Selfie verification started');
      expect(logged).toContain('"step":2');
      expect(logged).not.toContain('secret_token');
      expect(logged).not.toContain('private.jpg');
      expect(logged).not.toContain('sensitive_jwt');
      spy.mockRestore();
    });
  });
});
