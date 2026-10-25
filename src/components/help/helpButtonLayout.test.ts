import { BAR_CONTENT_HEIGHT } from '@/components/barMetrics';
import * as fs from 'fs';
import * as path from 'path';
import { HEADERLESS, HELP_GAP, helpButtonPlacement, isHelpButtonHidden } from './helpButtonLayout';

/**
 * Where the global Help button shows, where it steps aside and why, and where it sits when it does show: above the tab
 * bar, above the round add button, or just above the bottom edge. Each exception is a screen where a bottom-right
 * control would be covered, so each is pinned here.
 */
const phone = { bottom: 34 }; // a phone with a home indicator
const flat = { bottom: 0 }; // a phone without one

describe('where the button shows', () => {
  // Only where no header carries Help: sign-in and sign-up, and the screens drawn without the stack header.
  it.each([
    ['choose role, which draws its own screen', ['(auth)', 'choose-role']],
    ['the public scan screen, which has no header', ['(public)', 'scan', '[id]']],
  ])('is shown on %s', (_name, segments) => {
    expect(isHelpButtonHidden(segments)).toBe(false);
    expect(helpButtonPlacement(segments, phone).visible).toBe(true);
  });

  it.each([
    ['an app screen outside the tabs', ['(app)', 'bookings']],
    ['a dashboard sub screen', ['(app)', 'payments']],
    ['the streams list', ['(app)', 'streams']],
    ['an event page', ['(app)', 'event', '[id]']],
    ['the collaborate album screen', ['(app)', 'collaborate', 'album', '[id]']],
    ['a public page with a header', ['(public)', 'about']],
    ['notifications, whose own header carries Help', ['(app)', 'notifications']],
    ['sign in, whose photo band carries Help', ['(auth)', 'login']],
    ['sign up, whose photo band carries Help', ['(auth)', 'signup']],
    ['analytics, whose own header carries Help', ['(app)', 'analytics']],
    ['explore events, whose own header carries Help', ['(public)', 'explore-events']],
    ['an album page, whose own header carries Help', ['(app)', 'album', '[id]']],
    ['a received photobook, whose hero carries Help', ['(app)', 'photobook', '[id]']],
    ['the public event page, whose own header carries Help', ['(public)', 'event', '[id]']],
  ])('steps aside on %s, whose header carries Help', (_name, segments) => {
    expect(helpButtonPlacement(segments, phone)).toEqual({ visible: false, bottom: 0 });
  });

  it('knows exactly which stack screens are drawn without a header', () => {
    for (const group of ['(app)', '(public)'] as const) {
      const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app', group, '_layout.tsx'), 'utf8');
      const headerless = [...src.matchAll(/<Stack\.Screen\s+name="([^"]+)"([\s\S]*?)\/>/g)]
        .filter((m) => /headerShown:\s*false/.test(m[2]))
        .map((m) => m[1])
        .filter((n) => n !== '(tabs)');
      expect([...HEADERLESS[group]].sort()).toEqual(headerless.sort());
    }
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
    expect(helpButtonPlacement(['(auth)', 'choose-role'], phone, { ready: false }).visible).toBe(false);
    expect(helpButtonPlacement(['(auth)', 'choose-role'], phone, { ready: true }).visible).toBe(true);
  });

  it('matches whole screen names: stream is hidden but streams is not, event/new is hidden but event/newest is not', () => {
    expect(isHelpButtonHidden(['(app)', 'streams'])).toBe(false);
    expect(isHelpButtonHidden(['(app)', 'event', 'newest'])).toBe(false);
    expect(isHelpButtonHidden(['(app)', 'album', 'newer'])).toBe(false);
  });
});

describe('where it sits', () => {
  it('steps aside on every tab screen, whose top bar carries Help, so it never floats over a button', () => {
    for (const tab of ['index', 'events', 'wallet', 'inbox', 'profile', 'more']) {
      expect(helpButtonPlacement(['(app)', '(tabs)', tab], phone)).toEqual({ visible: false, bottom: 0 });
      expect(helpButtonPlacement(['(app)', '(tabs)', tab], flat).visible).toBe(false);
    }
  });

  it('sits just above the bottom edge where it shows', () => {
    const p = helpButtonPlacement(['(auth)', 'choose-role'], phone);
    expect(p.bottom).toBeGreaterThanOrEqual(34);
    expect(p.bottom).toBeLessThan(34 + BAR_CONTENT_HEIGHT);
    expect(helpButtonPlacement(['(auth)', 'choose-role'], flat).bottom).toBeGreaterThan(0);
  });

  it.each([
    ['packages', ['(app)', 'packages']],
    ['the public gallery', ['(public)', 'gallery']],
  ])('never floats over the round add button on %s: the header carries Help there', (_n, segments) => {
    expect(helpButtonPlacement(segments, phone).visible).toBe(false);
  });
});
