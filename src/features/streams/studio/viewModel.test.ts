import {
  createStreamerLiveViewModel,
  nextOnAirLatch,
  resolveStudioStatus,
} from './viewModel';

/**
 * Tapping GO LIVE showed "Preparing your LIVE..." and then dropped back to the
 * pre-live screen. The server reports "connected" only after Cloudflare sees the
 * encoder, so right after a successful go-live it still said "disconnected" and
 * the studio read that as "not live yet". Once the host has gone live, the live
 * studio must stay up, with the connection chip showing reconnecting.
 */
describe('resolveStudioStatus', () => {
  it('keeps the live studio up after go-live while the encoder is unconfirmed', () => {
    expect(resolveStudioStatus('disconnected', true)).toBe('connected');
    expect(resolveStudioStatus('idle', true)).toBe('connected');
  });

  it('stays pre-live before the host has gone live', () => {
    expect(resolveStudioStatus('disconnected', false)).toBe('disconnected');
    expect(resolveStudioStatus('idle', false)).toBe('idle');
  });

  it('never overrides a state the server decided', () => {
    expect(resolveStudioStatus('paused', true)).toBe('paused');
    expect(resolveStudioStatus('ended', true)).toBe('ended');
    expect(resolveStudioStatus('connected', false)).toBe('connected');
  });
});

describe('nextOnAirLatch', () => {
  it('latches on when the server reports live or paused', () => {
    expect(nextOnAirLatch('connected', false)).toBe(true);
    expect(nextOnAirLatch('paused', false)).toBe(true);
  });

  it('ignores a transient disconnect, so a network blip does not bounce to pre-live', () => {
    expect(nextOnAirLatch('disconnected', true)).toBe(true);
    expect(nextOnAirLatch('disconnected', false)).toBe(false);
  });

  it('clears when the stream has ended', () => {
    expect(nextOnAirLatch('ended', true)).toBe(false);
  });
});

describe('createStreamerLiveViewModel with an unconfirmed encoder', () => {
  const base = { mode: 'browser' as const, publishStatus: 'publishing' as const, networkError: false };

  it('is live (not pre-live) and shows reconnecting', () => {
    const vm = createStreamerLiveViewModel({
      ...base,
      status: resolveStudioStatus('disconnected', true),
      encoderPending: true,
    });
    expect(vm.isLive).toBe(true);
    expect(vm.isPreLive).toBe(false);
    expect(vm.connection).toBe('reconnecting');
  });

  it('shows a good connection once the encoder is confirmed', () => {
    const vm = createStreamerLiveViewModel({ ...base, status: 'connected', encoderPending: false });
    expect(vm.connection).toBe('good');
  });
});
