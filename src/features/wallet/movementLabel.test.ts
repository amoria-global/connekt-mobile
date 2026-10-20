import { humanizeCodes, movementTitle } from './movementLabel';

describe('movement labels', () => {
  it('turns embedded backend codes into plain words', () => {
    expect(humanizeCodes('Booking payment (held until MS1_PHOTOBOOK_HOLD is released)')).toBe('Booking payment (held until photobook hold is released)');
    expect(humanizeCodes('Booking MS1_UPFRONT (net of 9% fee)')).toBe('Booking upfront payment (net of 9% fee)');
    expect(humanizeCodes('Escrow release: DELIVERY_HOLD_RELEASED_ALBUM_SUBMITTED')).toBe('Escrow release: delivery hold released album submitted');
  });

  it('leaves ordinary text and single words alone, so an unknown description is never mangled', () => {
    expect(humanizeCodes('Booking payment for SYNTHETIC booking event')).toBe('Booking payment for SYNTHETIC booking event');
    expect(humanizeCodes('USD wallet top up')).toBe('USD wallet top up');
    expect(humanizeCodes('')).toBe('');
  });

  it('capitalises a title that began with a code', () => {
    expect(movementTitle('PHOTOBOOK_HOLD_RELEASED')).toBe('Photobook hold released');
    expect(movementTitle('Corporate Gala')).toBe('Corporate Gala');
  });
});
