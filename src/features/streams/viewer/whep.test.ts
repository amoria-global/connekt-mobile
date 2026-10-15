import {
  WHEP_FIRST_FRAME_TIMEOUT_MS,
  WHEP_MAX_BACKOFF_MS,
  WHEP_STALL_THRESHOLD_MS,
  buildWhepHtml,
  parseWhepMessage,
  whepBackoffMs,
  whepPhase,
} from './whep';

/**
 * The phone now watches the feed the way the website does: WebRTC (WHEP) with
 * reconnects that never give up. These pin the numbers ported from the web's
 * WHEPClient and guard the generated player page.
 */
describe('whepBackoffMs', () => {
  it('backs off 1 s, 2 s, 4 s, then holds at the 5 s ceiling, like the web client', () => {
    expect([1, 2, 3, 4, 5, 50].map(whepBackoffMs)).toEqual([1000, 2000, 4000, 5000, 5000, 5000]);
  });

  it('never exceeds the ceiling and treats attempt 0 as the first attempt', () => {
    expect(whepBackoffMs(0)).toBe(1000);
    expect(whepBackoffMs(999)).toBeLessThanOrEqual(WHEP_MAX_BACKOFF_MS);
  });
});

describe('parseWhepMessage', () => {
  it('accepts the four status values the page posts', () => {
    for (const s of ['connecting', 'playing', 'buffering', 'reconnecting']) {
      expect(parseWhepMessage(JSON.stringify({ t: 'status', s }))).toEqual({ t: 'status', s });
    }
  });

  it('ignores anything else', () => {
    expect(parseWhepMessage('not json')).toBeNull();
    expect(parseWhepMessage(JSON.stringify({ t: 'status', s: 'exploding' }))).toBeNull();
    expect(parseWhepMessage(JSON.stringify({ t: 'other' }))).toBeNull();
  });
});

describe('buildWhepHtml', () => {
  const url = 'https://customer-abc.cloudflarestream.com/live-input-1/webRTC/play';
  const html = buildWhepHtml(url);
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('embeds the WHEP URL and the web client behaviours', () => {
    expect(script).toContain(JSON.stringify(url));
    expect(script).toContain("direction: 'recvonly'");
    expect(script).toContain('stun:stun.cloudflare.com:3478');
    expect(script).toContain(`var STALL_MS = ${WHEP_STALL_THRESHOLD_MS};`);
    expect(script).toContain("st === 'failed' || st === 'disconnected'");
    expect(script).toContain('inbound-rtp');
  });

  it('leaves no unreplaced template placeholders', () => {
    expect(html).not.toContain('${');
  });

  it('is valid JavaScript (parsed, not run)', () => {
    expect(() => new Function(script)).not.toThrow();
  });

  it('cannot be broken out of the script tag by a hostile URL', () => {
    const evil = buildWhepHtml('https://x.test/</script><script>alert(1)</script>');
    expect(evil.match(/<script>/g)).toHaveLength(1);
    expect(evil.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe('first-frame safety net', () => {
  it('is long enough for a slow network but short enough to avoid a black screen', () => {
    expect(WHEP_FIRST_FRAME_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(WHEP_FIRST_FRAME_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

describe('whepPhase', () => {
  it('shows connecting until the first frame, then buffering between frames', () => {
    expect(whepPhase('connecting', false)).toBe('connecting');
    expect(whepPhase('connecting', true)).toBe('buffering');
    expect(whepPhase('buffering', false)).toBe('buffering');
  });

  it('shows playing, and reads a drop as reconnecting, never as a permanent error', () => {
    expect(whepPhase('playing', true)).toBe('playing');
    expect(whepPhase('reconnecting', true)).toBe('reconnecting');
    expect(whepPhase('reconnecting', false)).toBe('reconnecting');
  });
});
