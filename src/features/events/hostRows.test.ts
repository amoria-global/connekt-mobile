import { hostRows } from './hostRows';

describe('hostRows', () => {
  it('is one row with both chips when the organizer and photographer are the same user id', () => {
    const rows = hostRows({ creator: { id: 'u1', firstName: 'Joseph', lastName: 'Maranatha' }, photographerId: 'u1', photographerName: 'Joseph Maranatha' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Joseph Maranatha', roles: ['ORGANIZER', 'PHOTOGRAPHER'], photographerId: 'u1' });
  });

  it('is two rows for different users, even when their names match', () => {
    const rows = hostRows({ creator: { id: 'u1', firstName: 'Eric', lastName: 'Mugisha' }, photographerId: 'u2', photographerName: 'Eric Mugisha' });
    expect(rows.map((r) => r.roles)).toEqual([['ORGANIZER'], ['PHOTOGRAPHER']]);
  });

  it('does not merge when an id is missing, whatever the names say', () => {
    expect(hostRows({ creator: { firstName: 'A', lastName: 'B' }, photographerName: 'A B' })).toHaveLength(2);
  });

  it('shows only the side that exists, falling back to the stored organizer name', () => {
    expect(hostRows({ eventOrganizer: 'The Mugisha family' }).map((r) => r.name)).toEqual(['The Mugisha family']);
    expect(hostRows({ photographerName: 'Eric' }).map((r) => r.key)).toEqual(['photographer']);
    expect(hostRows({})).toEqual([]);
  });
});
