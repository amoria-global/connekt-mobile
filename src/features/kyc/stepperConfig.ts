export type Step = 1 | 2 | 3 | 4;

export const TOTAL_STEPS = 4;

export const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Selfie' },
  { id: 3, label: 'ID Photo' },
  { id: 4, label: 'Review' },
];

export function getStepStatus(
  stepId: Step,
  currentStep: Step,
): 'passed' | 'active' | 'remaining' {
  if (stepId < currentStep) return 'passed';
  if (stepId === currentStep) return 'active';
  return 'remaining';
}

export function isConnectorPassed(
  index: number,
  isLeft: boolean,
  currentStep: Step,
): boolean {
  const step = STEPS[index];
  if (!step) return false;
  const isPassed = step.id < currentStep;
  const isActive = step.id === currentStep;
  if (isLeft) return isPassed || isActive;
  return isPassed;
}
