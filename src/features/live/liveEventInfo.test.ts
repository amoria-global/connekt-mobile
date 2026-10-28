import { mapLiveEventInfo, taglineOf } from './liveEventInfo';

describe('taglineOf', () => {
  it('takes the first sentence of the description and caps it', () => {
    expect(taglineOf('A night of music. Join us live.')).toBe('A night of music.');
    expect(taglineOf('  Line one\nline two  ')).toBe('Line one line two');
    expect(taglineOf('x'.repeat(200))).toHaveLength(140);
    expect(taglineOf('x'.repeat(200))?.endsWith('...')).toBe(true);
  });
  it('is undefined when there is no description', () => {
    expect(taglineOf(undefined)).toBeUndefined();
    expect(taglineOf('   ')).toBeUndefined();
  });
});

describe('mapLiveEventInfo', () => {
  it('shows Ticket when the event charges for the stream, Free otherwise', () => {
    expect(mapLiveEventInfo({ streamFee: 5000 }).access).toBe('ticket');
    expect(mapLiveEventInfo({ streamFee: 0 }).access).toBe('free');
    expect(mapLiveEventInfo({}).access).toBe('free');
  });
  it('closes wishes once the event has ended, and keeps them open before and during it', () => {
    for (const s of ['COMPLETED', 'AWAITING_REVIEW', 'cancelled']) expect(mapLiveEventInfo({ eventStatus: s }).wishesClosed).toBe(true);
    for (const s of ['PUBLISHED', 'UPCOMING', 'ONGOING', undefined]) expect(mapLiveEventInfo({ eventStatus: s }).wishesClosed).toBe(false);
  });
  it('trims the location and drops an empty one', () => {
    expect(mapLiveEventInfo({ location: ' Hey, Kigali ' }).location).toBe('Hey, Kigali');
    expect(mapLiveEventInfo({ location: '  ' }).location).toBeUndefined();
  });
});
