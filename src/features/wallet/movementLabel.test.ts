import { humanizeCodes, movementTitle, FALLBACK_TITLE } from './movementLabel';

describe('movement labels', () => {
  it('turns embedded backend codes into plain words', () => {
    expect(humanizeCodes('Booking payment (held until MS1_PHOTOBOOK_HOLD is released)')).toBe('Booking payment (held until photobook hold is released)');
    expect(humanizeCodes('Booking MS1_UPFRONT (net of 9% fee)')).toBe('Booking upfront payment (net of 9% fee)');
    expect(humanizeCodes('Escrow release: DELIVERY_HOLD_RELEASED_ALBUM_SUBMITTED')).toBe('Escrow release: delivery hold released album submitted');
  });

  it('an unknown code is a readable sentence-case title: MS1_PHOTOBOOK_HOLD -> "Photobook hold"', () => {
    expect(movementTitle('MS1_PHOTOBOOK_HOLD')).toBe('Photobook hold');
    expect(movementTitle('PHOTOBOOK_HOLD_RELEASED')).toBe('Photobook hold released');
    expect(movementTitle('MS12_V2_SOME_NEW_CODE')).toBe('Some new code');
  });

  it('strips every leading milestone prefix, not only the first', () => {
    expect(humanizeCodes('Fee MS1_V2_FEE_WAIVED')).toBe('Fee fee waived');
  });

  it('leaves ordinary text and single words alone, so an unknown description is never mangled', () => {
    expect(humanizeCodes('Booking payment for SYNTHETIC booking event')).toBe('Booking payment for SYNTHETIC booking event');
    expect(humanizeCodes('USD wallet top up')).toBe('USD wallet top up');
    expect(movementTitle('Corporate Gala')).toBe('Corporate Gala');
  });

  it('falls back to a generic label when nothing readable remains', () => {
    expect(movementTitle('')).toBe(FALLBACK_TITLE);
    expect(movementTitle('   ')).toBe(FALLBACK_TITLE);
    expect(movementTitle('MS1_V2')).toBe(FALLBACK_TITLE);
    expect(movementTitle('MS1_V2_')).toBe(FALLBACK_TITLE);
  });
});
