import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { listPhotographers } from '@/features/photographers/api';
import { listPublicEventsDetailed } from '@/features/events/api';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/features/photographers/api', () => ({ listPhotographers: jest.fn() }));
jest.mock('@/features/events/api', () => ({ listPublicEventsDetailed: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/storage', () => ({ storage: { get: jest.fn(async () => null), set: jest.fn(async () => {}), remove: jest.fn(async () => {}) } }));

const mockPhotogs = listPhotographers as jest.Mock;
const mockEvents = listPublicEventsDetailed as jest.Mock;
const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function open(query: string) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<GlobalSearchModal visible onClose={() => {}} initialQuery={query} />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 400));
  });
  return r;
}

beforeEach(() => {
  mockPhotogs.mockReset();
  mockEvents.mockReset();
});

describe('global search failure states', () => {
  it('a failed events request is "unavailable" with a retry, not "No results found"', async () => {
    mockPhotogs.mockResolvedValue([]);
    mockEvents.mockRejectedValue(new Error('offline'));
    const text = flat((await open('wedding')).root);
    expect(text).toContain('could not be loaded');
    expect(text).not.toContain('No results found');
  });

  it('with nothing at all to show, a failure is the full "unavailable" panel with a retry', async () => {
    mockPhotogs.mockResolvedValue([]);
    mockEvents.mockRejectedValue(new Error('offline'));
    const text = flat((await open('zzz')).root);
    expect(text).toContain('Search is unavailable right now');
    expect(text).toContain('Try again');
    expect(text).not.toContain('No results found');
  });

  it('a failed photographer directory is also "unavailable", not an empty result', async () => {
    mockPhotogs.mockRejectedValue(new Error('offline'));
    mockEvents.mockResolvedValue({ content: [] });
    const text = flat((await open('zzz')).root);
    expect(text).toContain('Search is unavailable right now');
    expect(text).not.toContain('No results found');
  });

  it('a successful empty answer still says no results', async () => {
    mockPhotogs.mockResolvedValue([]);
    mockEvents.mockResolvedValue({ content: [] });
    const text = flat((await open('zzz')).root);
    expect(text).toContain('No results found');
    expect(text).not.toContain('unavailable');
  });

  it('Try again re-runs the search and recovers', async () => {
    mockPhotogs.mockResolvedValue([]);
    mockEvents.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ content: [] });
    const r = await open('zzz');
    const retry = r.root.findAll((n) => n.props?.accessibilityLabel === 'Try again' && typeof n.props.onPress === 'function')[0];
    await act(async () => {
      retry.props.onPress();
    });
    await act(async () => {
      await new Promise((res) => setTimeout(res, 400));
    });
    expect(mockEvents).toHaveBeenCalledTimes(2);
    expect(flat(r.root)).toContain('No results found');
  });

  it('a slow answer for an older term does not overwrite the newer one', async () => {
    mockPhotogs.mockResolvedValue([]);
    let slow!: (v: unknown) => void;
    mockEvents
      .mockImplementationOnce(() => new Promise((res) => { slow = res; }))
      .mockResolvedValueOnce({ content: [] });
    const r = await open('wed');
    const input = r.root.findByType(TextInput);
    await act(async () => {
      input.props.onChangeText('wedding');
    });
    await act(async () => {
      await new Promise((res) => setTimeout(res, 400));
    });
    await act(async () => {
      slow({ content: [{ id: 'old', title: 'Stale Wed Result', eventDate: '2026-10-01' }] });
    });
    expect(flat(r.root)).not.toContain('Stale Wed Result');
  });
});
