import { BAR_CONTENT_HEIGHT, FAB_SIZE, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/components/barMetrics';
import { HELP_GAP, helpButtonPlacement, isHelpButtonHidden } from './helpButtonLayout';

/**
 * Where the global Help button shows, where it steps aside and why, and where it sits when it does show: above the tab
 * bar, above the round add button, or just above the bottom edge. Each exception is a screen where a bottom-right
 * control would be covered, so each is pinned here.
 */
const phone = { bottom: 34 }; // a phone with a home indicator
const flat = { bottom: 0 }; // a phone without one

describe('where the button shows', () => {
  it.each([
    ['a tab screen', ['(app)', '(tabs)', 'index']],
    ['the wallet tab', ['(app)', '(tabs)', 'wallet']],
    ['an app screen outside the tabs', ['(app)', 'bookings']],
    ['a dashboard sub screen', ['(app)', 'analytics']],
    ['the streams list, not a stream', ['(app)', 'streams']],
    ['an event page, not the wizard', ['(app)', 'event', '[id]']],
    ['an album page, not the new album form', ['(app)', 'album', '[id]']],
    ['sign in', ['(auth)', 'login']],
    ['sign up', ['(auth)', 'signup']],
    ['a public page', ['(public)', 'explore-events']],
    ['the collaborate album screen', ['(app)', 'collaborate', 'album', '[id]']],
  ])('is shown on %s', (_name, segments) => {
    expect(isHelpButtonHidden(segments)).toBe(false);
    expect(helpButtonPlacement(segments, phone).visible).toBe(true);
  });
});

describe('where it steps aside', () => {
  it.each([
    ['the Help Center itself', ['(public)', 'help-center']],
    ['a Help Center page', ['(public)', 'help-center', 'payment']],
    ['Contact us, which Help leads to', ['(public)', 'contact_us']],
    ['Feedback, which Help leads to', ['(public)', 'feedback']],
    ['first-run onboarding', ['(onboarding)', 'welcome']],
    ['the first-run terms', ['(onboarding)', 'terms']],
    ['a chat, where the send button is bottom right', ['(app)', 'conversation', '[id]']],
    ['a live stream', ['(app)', 'stream', '[id]']],
    ['the stream studio', ['(app)', 'stream', 'control', '[id]']],
    ['the public live stream', ['(public)', 'events', 'live-stream']],
    ['identity verification with the live selfie', ['(app)', 'kyc']],
    ['the new event wizard', ['(app)', 'event', 'new']],
    ['the hybrid booking wizard', ['(app)', 'event', 'hybrid-wizard']],
    ['the new album form', ['(app)', 'album', 'new']],
    ['a screen that is not routed yet', []],
  ])('is hidden on %s', (_name, segments) => {
    expect(isHelpButtonHidden(segments)).toBe(true);
    expect(helpButtonPlacement(segments, phone)).toEqual({ visible: false, bottom: 0 });
  });

  it('is hidden while the keyboard is open, so it never sits on top of what is being typed', () => {
    expect(helpButtonPlacement(['(app)', 'bookings'], phone, { keyboardVisible: true }).visible).toBe(false);
  });

  it('is hidden for a screen that asks to have the corner to itself', () => {
    expect(helpButtonPlacement(['(app)', 'bookings'], phone, { optedOut: true }).visible).toBe(false);
  });

  it('waits until the app is ready, so it does not sit on the intro video', () => {
    expect(helpButtonPlacement(['(auth)', 'login'], phone, { ready: false }).visible).toBe(false);
    expect(helpButtonPlacement(['(auth)', 'login'], phone, { ready: true }).visible).toBe(true);
  });

  it('matches whole screen names: stream is hidden but streams is not, event/new is hidden but event/newest is not', () => {
    expect(isHelpButtonHidden(['(app)', 'streams'])).toBe(false);
    expect(isHelpButtonHidden(['(app)', 'event', 'newest'])).toBe(false);
    expect(isHelpButtonHidden(['(app)', 'album', 'newer'])).toBe(false);
  });
});

describe('where it sits', () => {
  it('goes above the tab bar on the tab screens, whatever the phone', () => {
    expect(helpButtonPlacement(['(app)', '(tabs)', 'index'], phone).bottom).toBe(34 + BAR_CONTENT_HEIGHT + HELP_GAP);
    // Without a home indicator the bar still has its own 8 points of padding.
    expect(helpButtonPlacement(['(app)', '(tabs)', 'index'], flat).bottom).toBe(8 + BAR_CONTENT_HEIGHT + HELP_GAP);
  });

  it('is clear of the tab bar on every tab', () => {
    for (const tab of ['index', 'events', 'wallet', 'inbox', 'more']) {
      const p = helpButtonPlacement(['(app)', '(tabs)', tab], phone);
      expect(p.bottom).toBeGreaterThanOrEqual(34 + BAR_CONTENT_HEIGHT);
    }
  });

  it('sits just above the bottom edge on screens with no tab bar', () => {
    const p = helpButtonPlacement(['(app)', 'bookings'], phone);
    expect(p.bottom).toBeGreaterThanOrEqual(34);
    expect(p.bottom).toBeLessThan(34 + BAR_CONTENT_HEIGHT);
    expect(helpButtonPlacement(['(auth)', 'login'], flat).bottom).toBeGreaterThan(0);
  });

  it.each([
    ['packages', ['(app)', 'packages']],
    ['the public gallery', ['(public)', 'gallery']],
  ])('lifts above the round add button on %s, which sits where %s draws it', (_n, segments) => {
    const fabBottom = (phone.bottom > 0 ? phone.bottom : TAB_BAR_MARGIN) + TAB_BAR_HEIGHT + 12;
    const p = helpButtonPlacement(segments, phone);
    expect(p.bottom).toBeGreaterThanOrEqual(fabBottom + FAB_SIZE);
    // And without a home indicator the add button uses its own margin, so the lift follows it.
    const noIndicator = helpButtonPlacement(segments, flat);
    expect(noIndicator.bottom).toBeGreaterThanOrEqual(TAB_BAR_MARGIN + TAB_BAR_HEIGHT + 12 + FAB_SIZE);
  });

  it('does not lift on the signed-in gallery, which has no add button', () => {
    expect(helpButtonPlacement(['(app)', 'gallery'], phone).bottom).toBe(helpButtonPlacement(['(app)', 'bookings'], phone).bottom);
  });

  it('does not lift on the same word in a different place', () => {
    expect(helpButtonPlacement(['(app)', 'photobooks'], phone).bottom).toBe(helpButtonPlacement(['(app)', 'bookings'], phone).bottom);
  });
});
