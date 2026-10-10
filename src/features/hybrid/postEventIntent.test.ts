import {
  PENDING_POST_TTL_MS,
  pendingPostDelivery,
  pendingPostEvent,
  postChoiceTarget,
} from '@/features/hybrid/postEventIntent';

beforeEach(() => pendingPostEvent.clear());

describe('postChoiceTarget', () => {
  it('asks a guest to sign in on the screen they are on when it can (the sign-in screen)', () => {
    expect(postChoiceTarget({ signedIn: false, canAskSignIn: true, canOpenInPlace: false })).toBe('ask-sign-in-here');
  });

  it('sends a guest to /login only from a screen that cannot ask itself', () => {
    expect(postChoiceTarget({ signedIn: false, canAskSignIn: false, canOpenInPlace: false })).toBe('login-screen');
  });

  it('opens the wizard for a signed-in owner, in place when the host can', () => {
    expect(postChoiceTarget({ signedIn: true, canAskSignIn: false, canOpenInPlace: true })).toBe('wizard-in-place');
    expect(postChoiceTarget({ signedIn: true, canAskSignIn: false, canOpenInPlace: false })).toBe('wizard-screen');
  });
});

describe('pendingPostEvent', () => {
  it('is empty until set, and take() reads and clears it', () => {
    expect(pendingPostEvent.has()).toBe(false);
    pendingPostEvent.set(1_000);
    expect(pendingPostEvent.has(1_000)).toBe(true);
    expect(pendingPostEvent.take(1_000)).toBe(true);
    expect(pendingPostEvent.take(1_000)).toBe(false);
  });

  it('goes stale so a guest who wandered off is not ambushed at a later login', () => {
    pendingPostEvent.set(0);
    expect(pendingPostEvent.has(PENDING_POST_TTL_MS)).toBe(true);
    expect(pendingPostEvent.take(PENDING_POST_TTL_MS + 1)).toBe(false);
    expect(pendingPostEvent.has(0)).toBe(false);
  });

  it('clear() cancels it', () => {
    pendingPostEvent.set();
    pendingPostEvent.clear();
    expect(pendingPostEvent.take()).toBe(false);
  });
});

describe('pendingPostDelivery', () => {
  it('opens in place for a client and on the wizard screen for a coordinator', () => {
    expect(pendingPostDelivery('Client')).toBe('in-place');
    expect(pendingPostDelivery('Coordinator')).toBe('wizard-screen');
  });

  it('drops it for roles that cannot post', () => {
    expect(pendingPostDelivery('Photographer')).toBe('drop');
    expect(pendingPostDelivery('Viewer')).toBe('drop');
  });

  it('waits while the role is unknown rather than guessing one', () => {
    expect(pendingPostDelivery(undefined)).toBe('wait');
  });
});
