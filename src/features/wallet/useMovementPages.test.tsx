import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { listWalletMovementsPage, type Movement, type MovementPage } from './api';
import { useMovementPages } from './useMovementPages';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/store/auth', () => ({
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const mockGetOk = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
  },
}));

const row = (id: string) => ({ id, direction: 'IN', amount: 1, category: 'BOOKING' });
const mv = (id: string): Movement => ({ id, direction: 'in', amount: 1, category: 'BOOKING' });

beforeEach(() => mockGetOk.mockReset());

describe('listWalletMovementsPage', () => {
  it('reads the Spring Page last flag', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [row('a')], last: false } });
    expect((await listWalletMovementsPage(0, 50)).hasMore).toBe(true);
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [row('a')], last: true } });
    expect((await listWalletMovementsPage(0, 50)).hasMore).toBe(false);
  });
  it('requests the page and size it was given', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [], last: true } });
    await listWalletMovementsPage(2, 50);
    expect(mockGetOk).toHaveBeenCalledWith('/wallet/me/movements?page=2&size=50');
  });
});

function mount(first: MovementPage | null) {
  const box: { current: ReturnType<typeof useMovementPages> | null } = { current: null };
  let props = first;
  function Probe() {
    box.current = useMovementPages(props);
    return null;
  }
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<Probe />);
  });
  return {
    box,
    setFirst: (p: MovementPage | null) => {
      props = p;
      act(() => r.update(<Probe />));
    },
  };
}

describe('useMovementPages', () => {
  it('appends the next page, de-duplicating, and stops at the last page', async () => {
    const h = mount({ items: [mv('1'), mv('2')], hasMore: true });
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [row('2'), row('3')], last: true } });
    await act(async () => {
      await h.box.current!.loadMore();
    });
    expect(h.box.current!.items.map((m) => m.id)).toEqual(['1', '2', '3']);
    expect(h.box.current!.hasMore).toBe(false);
    expect(mockGetOk).toHaveBeenCalledWith('/wallet/me/movements?page=1&size=50');
  });

  it('reports a failed page without losing what is shown, and can retry', async () => {
    const h = mount({ items: [mv('1')], hasMore: true });
    mockGetOk.mockRejectedValueOnce({ status: 500, message: 'down' });
    await act(async () => {
      await h.box.current!.loadMore();
    });
    expect(h.box.current!.moreError).toBe('down');
    expect(h.box.current!.items).toHaveLength(1);
    expect(h.box.current!.hasMore).toBe(true);
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [row('9')], last: true } });
    await act(async () => {
      await h.box.current!.loadMore();
    });
    expect(h.box.current!.moreError).toBeNull();
    expect(h.box.current!.items.map((m) => m.id)).toEqual(['1', '9']);
  });

  it('discards appended pages when the first page is refreshed', async () => {
    const h = mount({ items: [mv('1')], hasMore: true });
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [row('2')], last: false } });
    await act(async () => {
      await h.box.current!.loadMore();
    });
    expect(h.box.current!.items).toHaveLength(2);
    h.setFirst({ items: [mv('0'), mv('1')], hasMore: true });
    expect(h.box.current!.items.map((m) => m.id)).toEqual(['0', '1']);
    expect(h.box.current!.hasMore).toBe(true);
  });

  it('stops instead of looping when a page brings nothing new', async () => {
    const h = mount({ items: [mv('1')], hasMore: true });
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [row('1')], last: false } });
    await act(async () => {
      await h.box.current!.loadMore();
    });
    expect(h.box.current!.hasMore).toBe(false);
  });
});
