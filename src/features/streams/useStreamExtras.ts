import { useCallback, useEffect, useRef, useState } from 'react';
import { listStreamHistory, loadStreamEventExtras, type Stream, type StreamHistory } from './api';
import type { StreamCounts } from './streamsModel';

/** The web reads every stream's chats at once; a phone reads a few at a time so the list stays responsive. */
const CONCURRENCY = 4;

type Entry = { history?: StreamHistory; extras?: Partial<Stream>; failed?: boolean };

/**
 * After the list is on screen, reads what the web reads per stream: the chat history (so messages, video messages and
 * the "N new" badge can be shown) and, when the feed lacks a cover or photographer, the public event. A failed read
 * leaves that stream's figures unknown (never zero) and can be retried.
 */
export function useStreamExtras(streams: readonly Stream[] | undefined, asCoordinator: boolean) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const started = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadOne = useCallback(
    async (s: Stream) => {
      const needsEvent = !s.thumbnail || !s.photographerName;
      const [history, extras] = await Promise.allSettled([
        listStreamHistory(s.id, asCoordinator),
        needsEvent ? loadStreamEventExtras(s.id) : Promise.resolve(undefined),
      ]);
      return {
        history: history.status === 'fulfilled' ? history.value : undefined,
        extras: extras.status === 'fulfilled' ? extras.value : undefined,
        failed: history.status === 'rejected',
      } as Entry;
    },
    [asCoordinator],
  );

  useEffect(() => {
    if (!streams) return;
    // Streams already started are not read again (a delete or a re-render changes the list but not their history).
    const queue = streams.filter((s) => !started.current.has(s.id));
    queue.forEach((s) => started.current.add(s.id));
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const s = queue[next++];
        const entry = await loadOne(s);
        if (!mounted.current) return;
        setEntries((prev) => ({ ...prev, [s.id]: entry }));
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }, [streams, loadOne]);

  /** Read one stream's history again (the sheets' retry), and put the result in. */
  const reload = useCallback(
    async (s: Stream) => {
      const entry = await loadOne(s);
      setEntries((prev) => ({ ...prev, [s.id]: entry }));
      return entry;
    },
    [loadOne],
  );

  /** Pull to refresh: read every stream again. */
  const resetAll = useCallback(() => {
    started.current.clear();
    setEntries({});
  }, []);

  const forget = useCallback((id: string) => {
    setEntries((prev) => {
      const { [id]: _gone, ...rest } = prev;
      return rest;
    });
  }, []);

  const counts: Record<string, StreamCounts | undefined> = {};
  for (const [id, e] of Object.entries(entries)) {
    counts[id] = e.history ? { messages: e.history.messages.length, videos: e.history.videos.length } : undefined;
  }
  return { entries, counts, reload, forget, resetAll };
}

/** A stream with what the public event added, filling only what the feed left empty (the web's `s.x || evt.x`). */
export function withExtras(s: Stream, extras?: Partial<Stream>): Stream {
  if (!extras) return s;
  return {
    ...s,
    thumbnail: s.thumbnail ?? extras.thumbnail,
    photographerImage: s.photographerImage ?? extras.photographerImage,
    photographerName: s.photographerName ?? extras.photographerName,
    description: s.description ?? extras.description,
  };
}
