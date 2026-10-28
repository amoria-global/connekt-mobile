import { HEARTFELT_LINE, invitedByLine, sanitizeFrom, wishesOpen, wishLink } from './wishPage';

describe('wishPage', () => {
  it('links to the wish page, with the sharer name only when there is one', () => {
    expect(wishLink('ev 1')).toBe('https://connekyt.com/wish/ev%201');
    expect(wishLink('e1', 'Grace')).toBe('https://connekyt.com/wish/e1?from=Grace');
    expect(wishLink('e1', '  <script>  ')).toBe('https://connekyt.com/wish/e1?from=script');
    expect(wishLink('e1', '<>')).toBe('https://connekyt.com/wish/e1');
  });

  it('sanitises the name: no markup, no control characters, one space, 40 characters', () => {
    expect(sanitizeFrom('<b>Grace</b> "N"')).toBe('bGraceb N');
    expect(sanitizeFrom('Grace\n\tMukamana')).toBe('Grace Mukamana');
    expect(sanitizeFrom("Jean-Luc O'Neil Jr.")).toBe("Jean-Luc O'Neil Jr.");
    expect(sanitizeFrom('Zoë Ñandú')).toBe('Zoë Ñandú');
    expect(sanitizeFrom('a'.repeat(80))).toHaveLength(40);
    expect(sanitizeFrom(undefined)).toBe('');
  });

  it('hides the invited line when the name is empty', () => {
    expect(invitedByLine('Grace')).toBe('Grace invited you to send a wish for this event.');
    expect(invitedByLine('   ')).toBeNull();
    expect(invitedByLine('<>')).toBeNull();
    expect(invitedByLine(null)).toBeNull();
  });

  it('opens for upcoming and live events and closes for ended ones', () => {
    const now = Date.parse('2026-11-01T10:00:00Z');
    expect(wishesOpen({ eventDate: '2026-11-27', startTime: '16:00', eventStatus: 'PUBLISHED' }, now)).toBe(true);
    expect(wishesOpen({ eventDate: '2026-11-01', startTime: '09:00', eventStatus: 'ONGOING', streamStatus: 'connected' }, now)).toBe(true);
    expect(wishesOpen({ eventDate: '2026-10-01', startTime: '09:00', eventStatus: 'COMPLETED' }, now)).toBe(false);
    expect(wishesOpen({ eventDate: '2026-11-27', startTime: '16:00', eventStatus: 'CANCELLED' }, now)).toBe(false);
  });

  it('carries the heartfelt line the design specifies', () => {
    expect(HEARTFELT_LINE.startsWith("Some of the people you love can't be here.")).toBe(true);
  });
});
