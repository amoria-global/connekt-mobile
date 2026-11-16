import { HOST_FALLBACK, resolveHostName } from './hostName';

describe('resolveHostName', () => {
  const all = {
    creator: { firstName: 'Micheal', lastName: 'Jackson' },
    eventOrganizer: 'Kigali Gala Team',
    photographerName: 'Pho Tographer',
  };

  it('prefers the creator, then the organizer, then the photographer', () => {
    expect(resolveHostName(all)).toBe('Micheal Jackson');
    expect(resolveHostName({ ...all, creator: null })).toBe('Kigali Gala Team');
    expect(resolveHostName({ ...all, creator: null, eventOrganizer: '  ' })).toBe('Pho Tographer');
  });

  it('copes with a creator who has only one name', () => {
    expect(resolveHostName({ creator: { firstName: 'Aline' } })).toBe('Aline');
    expect(resolveHostName({ creator: { firstName: ' ', lastName: ' ' }, eventOrganizer: 'Team' })).toBe('Team');
  });

  it('never returns the word Organizer', () => {
    expect(resolveHostName({})).toBe(HOST_FALLBACK);
    expect(resolveHostName(null)).toBe(HOST_FALLBACK);
    expect(HOST_FALLBACK).not.toMatch(/organizer/i);
  });
});
