/**
 * Drag-to-reorder maths for the photobook photo grid. Pure, so it is tested without a gesture. A tile is picked up with
 * a long press and dropped where its centre lands; hold-then-tap (long press, then tap the destination) stays as the
 * accessible fallback for anyone who cannot drag.
 */

/** Where a tile picked up at `from` ends up after it moved (dx, dy) points, in a grid of equal square cells. */
export function dropIndex(from: number, dx: number, dy: number, cell: number, gap: number, cols: number, count: number): number {
  if (count <= 0 || cols <= 0 || cell <= 0) return from;
  const step = cell + gap;
  const col = from % cols;
  const row = Math.floor(from / cols);
  const rows = Math.ceil(count / cols);
  const toCol = Math.min(cols - 1, Math.max(0, Math.round(col + dx / step)));
  const toRow = Math.min(rows - 1, Math.max(0, Math.round(row + dy / step)));
  return Math.min(count - 1, toRow * cols + toCol);
}

/** The ids with the one at `from` moved to `to`. A move onto itself, or out of range, changes nothing. */
export function moveId<T>(ids: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const next = ids.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
