import {
  STEPS,
  TOTAL_STEPS,
  getStepStatus,
  isConnectorPassed,
} from './stepperConfig';

describe('KycStepper configuration and status logic', () => {
  it('defines exactly 4 sequential steps with expected labels', () => {
    expect(STEPS).toHaveLength(TOTAL_STEPS);
    expect(STEPS).toHaveLength(4);
    expect(STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(STEPS.map((s) => s.label)).toEqual(['Details', 'Selfie', 'ID Photo', 'Review']);
  });

  describe('step status categorization', () => {
    it('marks step 1 active and steps 2-4 remaining when on step 1', () => {
      expect(getStepStatus(1, 1)).toBe('active');
      expect(getStepStatus(2, 1)).toBe('remaining');
      expect(getStepStatus(3, 1)).toBe('remaining');
      expect(getStepStatus(4, 1)).toBe('remaining');
    });

    it('marks step 1 passed, step 2 active, steps 3-4 remaining when on step 2', () => {
      expect(getStepStatus(1, 2)).toBe('passed');
      expect(getStepStatus(2, 2)).toBe('active');
      expect(getStepStatus(3, 2)).toBe('remaining');
      expect(getStepStatus(4, 2)).toBe('remaining');
    });

    it('marks steps 1-2 passed, step 3 active, step 4 remaining when on step 3', () => {
      expect(getStepStatus(1, 3)).toBe('passed');
      expect(getStepStatus(2, 3)).toBe('passed');
      expect(getStepStatus(3, 3)).toBe('active');
      expect(getStepStatus(4, 3)).toBe('remaining');
    });

    it('marks steps 1-3 passed and step 4 active when on step 4', () => {
      expect(getStepStatus(1, 4)).toBe('passed');
      expect(getStepStatus(2, 4)).toBe('passed');
      expect(getStepStatus(3, 4)).toBe('passed');
      expect(getStepStatus(4, 4)).toBe('active');
    });
  });

  describe('connector line progression', () => {
    it('keeps all connectors grey/remaining on step 1', () => {
      // Step 1 right connector
      expect(isConnectorPassed(0, false, 1)).toBe(false);
      // Step 2 left connector
      expect(isConnectorPassed(1, true, 1)).toBe(false);
    });

    it('marks connection between step 1 and step 2 green on step 2', () => {
      // Step 1 right connector
      expect(isConnectorPassed(0, false, 2)).toBe(true);
      // Step 2 left connector
      expect(isConnectorPassed(1, true, 2)).toBe(true);
      // Step 2 right connector towards 3
      expect(isConnectorPassed(1, false, 2)).toBe(false);
    });

    it('marks all connectors up to step 4 green on step 4', () => {
      // 1 to 2
      expect(isConnectorPassed(0, false, 4)).toBe(true);
      expect(isConnectorPassed(1, true, 4)).toBe(true);
      // 2 to 3
      expect(isConnectorPassed(1, false, 4)).toBe(true);
      expect(isConnectorPassed(2, true, 4)).toBe(true);
      // 3 to 4
      expect(isConnectorPassed(2, false, 4)).toBe(true);
      expect(isConnectorPassed(3, true, 4)).toBe(true);
    });
  });
});
