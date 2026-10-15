import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useAsync } from '@/hooks/useAsync';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/store/auth', () => ({
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

type State = ReturnType<typeof useAsync<string>>;

function mountHook(fn: () => Promise<string>) {
  const box: { current: State | null } = { current: null };
  function Probe() {
    box.current = useAsync(fn);
    return null;
  }
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<Probe />);
  });
  return { box, unmount: () => act(() => r.unmount()) };
}

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useAsync', () => {
  it('drops an older response that resolves after a newer one', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const queue = [first, second];
    const { box } = mountHook(() => queue.shift()!.promise);

    // The mount request is `first`; a refresh starts `second`.
    await act(async () => {
      box.current!.refresh();
    });
    await act(async () => {
      second.resolve('new');
      await Promise.resolve();
    });
    await act(async () => {
      first.resolve('old');
      await Promise.resolve();
    });

    expect(box.current!.data).toBe('new');
    expect(box.current!.loading).toBe(false);
  });

  it('reports a failure and keeps loading honest', async () => {
    const d = deferred<string>();
    const { box } = mountHook(() => d.promise);
    expect(box.current!.loading).toBe(true);
    await act(async () => {
      d.reject({ message: 'Wallet unavailable' });
      await Promise.resolve();
    });
    expect(box.current!.error).toBe('Wallet unavailable');
    expect(box.current!.data).toBeNull();
    expect(box.current!.loading).toBe(false);
  });

  it('a silent refresh never raises loading and keeps the last data when it fails', async () => {
    const first = deferred<string>();
    const tick = deferred<string>();
    const queue = [first, tick];
    const { box } = mountHook(() => queue.shift()!.promise);
    await act(async () => {
      first.resolve('good');
      await Promise.resolve();
    });
    expect(box.current!.data).toBe('good');

    await act(async () => {
      box.current!.refreshQuietly();
    });
    expect(box.current!.loading).toBe(false);

    await act(async () => {
      tick.reject({ message: 'blip' });
      await Promise.resolve();
    });
    expect(box.current!.data).toBe('good');
    expect(box.current!.error).toBeNull();
    expect(box.current!.loading).toBe(false);
  });

  it('treats an event passed as the argument (onPress={refresh}) as a normal refresh', async () => {
    const first = deferred<string>();
    const again = deferred<string>();
    const queue = [first, again];
    const { box } = mountHook(() => queue.shift()!.promise);
    await act(async () => {
      first.resolve('a');
      await Promise.resolve();
    });
    await act(async () => {
      (box.current!.refresh as (e?: unknown) => Promise<void>)({ nativeEvent: {} });
    });
    expect(box.current!.loading).toBe(true);
    await act(async () => {
      again.resolve('b');
      await Promise.resolve();
    });
    expect(box.current!.data).toBe('b');
  });

  it('writes nothing after unmount', async () => {
    const d = deferred<string>();
    const errors: unknown[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(a);
    });
    const { box, unmount } = mountHook(() => d.promise);
    unmount();
    await act(async () => {
      d.resolve('late');
      await Promise.resolve();
    });
    expect(box.current!.data).toBeNull();
    expect(errors).toHaveLength(0);
    spy.mockRestore();
  });

  it('loads on mount and exposes the first result', async () => {
    const d = deferred<string>();
    const { box } = mountHook(() => d.promise);
    expect(box.current).toMatchObject({ loading: true, data: null, error: null });
    await act(async () => {
      d.resolve('first');
      await Promise.resolve();
    });
    expect(box.current).toMatchObject({ loading: false, data: 'first', error: null });
  });

  it('recovers on retry after a failed load, clearing the error', async () => {
    const bad = deferred<string>();
    const good = deferred<string>();
    const queue = [bad, good];
    const { box } = mountHook(() => queue.shift()!.promise);
    await act(async () => {
      bad.reject({ message: 'offline' });
      await Promise.resolve();
    });
    expect(box.current!.error).toBe('offline');
    await act(async () => {
      box.current!.refresh();
    });
    expect(box.current).toMatchObject({ loading: true, error: null });
    await act(async () => {
      good.resolve('back');
      await Promise.resolve();
    });
    expect(box.current).toMatchObject({ loading: false, data: 'back', error: null });
  });

  it('ignores an older request that FAILS after a newer one succeeded', async () => {
    const older = deferred<string>();
    const newer = deferred<string>();
    const queue = [older, newer];
    const { box } = mountHook(() => queue.shift()!.promise);
    await act(async () => {
      box.current!.refresh();
    });
    await act(async () => {
      newer.resolve('fresh');
      await Promise.resolve();
    });
    await act(async () => {
      older.reject({ message: 'stale failure' });
      await Promise.resolve();
    });
    expect(box.current).toMatchObject({ data: 'fresh', error: null, loading: false });
  });

  it('keeps the previous valid data when a foreground refresh fails, and says so', async () => {
    const first = deferred<string>();
    const again = deferred<string>();
    const queue = [first, again];
    const { box } = mountHook(() => queue.shift()!.promise);
    await act(async () => {
      first.resolve('kept');
      await Promise.resolve();
    });
    await act(async () => {
      box.current!.refresh();
    });
    await act(async () => {
      again.reject({ message: 'refresh failed' });
      await Promise.resolve();
    });
    expect(box.current).toMatchObject({ data: 'kept', error: 'refresh failed', loading: false });
  });

  it('keeps the spinner up until the newest of two overlapping foreground requests finishes', async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    const queue = [a, b];
    const { box } = mountHook(() => queue.shift()!.promise);
    await act(async () => {
      box.current!.refresh();
    });
    await act(async () => {
      a.resolve('superseded');
      await Promise.resolve();
    });
    expect(box.current).toMatchObject({ loading: true, data: null });
    await act(async () => {
      b.resolve('newest');
      await Promise.resolve();
    });
    expect(box.current).toMatchObject({ loading: false, data: 'newest' });
  });

  it('a quiet tick that supersedes a foreground request still ends the spinner', async () => {
    const fg = deferred<string>();
    const tick = deferred<string>();
    const queue = [fg, tick];
    const { box } = mountHook(() => queue.shift()!.promise);
    expect(box.current!.loading).toBe(true);
    await act(async () => {
      box.current!.refreshQuietly();
    });
    await act(async () => {
      tick.resolve('from tick');
      await Promise.resolve();
    });
    expect(box.current).toMatchObject({ loading: false, data: 'from tick' });
    await act(async () => {
      fg.resolve('late foreground');
      await Promise.resolve();
    });
    expect(box.current!.data).toBe('from tick');
  });
});
