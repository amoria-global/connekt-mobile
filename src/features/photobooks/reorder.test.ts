import { dropIndex, moveId } from './reorder';

// A 3 column grid of 100 point tiles with a 3 point gap: one step is 103 points.
const drop = (from: number, dx: number, dy: number, count = 8) => dropIndex(from, dx, dy, 100, 3, 3, count);

describe('photobook drag to reorder', () => {
  it('a small wobble drops the tile where it was', () => {
    expect(drop(4, 20, -15)).toBe(4);
  });
  it('moves one column and one row at a time', () => {
    expect(drop(4, 103, 0)).toBe(5);
    expect(drop(4, -103, 0)).toBe(3);
    expect(drop(4, 0, 103)).toBe(7);
    expect(drop(4, 0, -103)).toBe(1);
  });
  it('stays inside the grid and never past the last photo', () => {
    expect(drop(0, -500, -500)).toBe(0);
    expect(drop(4, 900, 900)).toBe(7);
    expect(drop(2, 0, 400, 5)).toBe(4);
  });
  it('moveId moves one id and changes nothing for a no-op or an out-of-range index', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    const ids = ['a', 'b'];
    expect(moveId(ids, 1, 1)).toBe(ids);
    expect(moveId(ids, 0, 5)).toBe(ids);
  });
});
