import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Modal, Text } from 'react-native';

import { UpdatePromptModal } from './UpdatePromptModal';
import { useUpdatesStore } from './useAppUpdates';

/**
 * The mandatory update prompt rendered over a FAKE expo-updates module.
 * Covers the download, restart, failure and retry paths. No real update is fetched.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { version: '2.2.2', extra: { releaseNotes: { releases: (globalThis as { __installedTop?: string }).__installedTop ? [{ id: (globalThis as { __installedTop?: string }).__installedTop, title: 'Installed', items: [{ title: 'x', body: 'y' }] }] : [] } } };
    },
  },
}));

const mockCheck = jest.fn();
const mockFetch = jest.fn();
const mockReload = jest.fn();
jest.mock('expo-updates', () => ({
  isEnabled: true,
  updateId: 'current',
  channel: 'production',
  isEmbeddedLaunch: false,
  latestContext: { isUpdatePending: false },
  checkForUpdateAsync: (...a: unknown[]) => mockCheck(...a),
  fetchUpdateAsync: (...a: unknown[]) => mockFetch(...a),
  reloadAsync: (...a: unknown[]) => mockReload(...a),
  addUpdatesStateChangeListener: () => ({ remove: () => {} }),
}));

const text = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const flush = async () => {
  await act(async () => {});
  await act(async () => {});
};
const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<UpdatePromptModal />);
  });
  await flush();
  return r;
};
const tapUpdate = async (r: TestRenderer.ReactTestRenderer) => {
  const btn = r.root.find((n) => n.props?.accessibilityLabel === 'Update now');
  await act(async () => {
    await btn.props.onPress();
  });
  await flush();
};

beforeEach(() => {
  mockCheck.mockReset();
  mockFetch.mockReset();
  mockReload.mockReset();
  useUpdatesStore.setState({
    status: 'idle',
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    updateReady: false,
    downloadProgress: 0,
    errorMessage: null,
    releases: [],
  });
  (globalThis as { __installedTop?: string }).__installedTop = undefined;
});

describe('mandatory update prompt', () => {
  it('shows nothing when the app is current', async () => {
    mockCheck.mockResolvedValue({ isAvailable: false });
    const r = await mount();
    expect(r.root.findAllByType(Modal)).toHaveLength(0);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('downloads an available update at once and offers one action, with no skip', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockResolvedValue({ isNew: true });
    const r = await mount();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const t = text(r.root);
    expect(t).toContain('New version available');
    expect(t).toContain('Update now');
    expect(t).not.toMatch(/Maybe later|Not Now|Dismiss|Skip|Later|Cancel/i);
    // Exactly one pressable, and it is the update action.
    const pressables = r.root.findAll((n) => n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function');
    expect(pressables).toHaveLength(1);
    expect(pressables[0].props.accessibilityLabel).toBe('Update now');
  });

  it('cannot be closed with the hardware back button', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockResolvedValue({ isNew: true });
    const r = await mount();
    const modal = r.root.findByType(Modal);
    expect(() => modal.props.onRequestClose?.()).not.toThrow();
    await flush();
    expect(r.root.findAllByType(Modal)).toHaveLength(1);
  });

  it('Update now restarts into the downloaded update', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockResolvedValue({ isNew: true });
    mockReload.mockResolvedValue(undefined);
    const r = await mount();
    await tapUpdate(r);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('a failed download stays blocking, says why, and the same button retries to completion', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockRejectedValueOnce(new Error('Network request failed.'));
    mockFetch.mockResolvedValue({ isNew: true });
    mockReload.mockResolvedValue(undefined);
    const r = await mount();
    let t = text(r.root);
    expect(t).toContain('Update did not finish');
    expect(t).toContain('Network request failed.');
    expect(t).toContain('Update now');
    expect(r.root.findAllByType(Modal)).toHaveLength(1);

    await tapUpdate(r);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('a failed restart stays blocking and can be retried', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockResolvedValue({ isNew: true });
    mockReload.mockRejectedValueOnce(new Error('Could not reload'));
    mockReload.mockResolvedValue(undefined);
    const r = await mount();
    await tapUpdate(r);
    expect(text(r.root)).toContain('Could not reload');
    expect(r.root.findAllByType(Modal)).toHaveLength(1);
    await tapUpdate(r);
    expect(mockReload).toHaveBeenCalledTimes(2);
  });

  it('an unreachable update service does not trap a current app, and does not loop', async () => {
    mockCheck.mockRejectedValue(new Error('offline'));
    const r = await mount();
    await flush();
    expect(r.root.findAllByType(Modal)).toHaveLength(0);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('a persistent download failure does not retry on its own', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockRejectedValue(new Error('timeout'));
    await mount();
    await flush();
    await flush();
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

const manifestWith = (releases: unknown[]) => ({ extra: { expoClient: { extra: { releaseNotes: { releases } } } } });
const rel = (id: string, title: string, items: [string, string][]) => ({
  id,
  date: '2026-10-21',
  title,
  items: items.map(([t, b]) => ({ title: t, body: b })),
});

describe('what the update changes, shown before the button', () => {
  it('lists every change of the downloaded update in full, with its description, above the one action', async () => {
    mockCheck.mockResolvedValue({
      isAvailable: true,
      manifest: manifestWith([
        rel('2026-10-21', 'Streams and a clearer start screen', [
          ['Streams match the web', 'Search, filters, chats, video messages and delete now work like the dashboard.'],
          ['Album photos load again', 'Photos and covers in paid albums now appear.'],
        ]),
      ]),
    });
    mockFetch.mockResolvedValue({ isNew: true });
    const r = await mount();
    const t = text(r.root);
    expect(t).toContain('2 changes to read before you update');
    expect(t).toContain('Streams and a clearer start screen');
    expect(t).toContain('Streams match the web');
    expect(t).toContain('Search, filters, chats, video messages and delete now work like the dashboard.');
    expect(t).toContain('Album photos load again');
    expect(t).toContain('21 Oct 2026');
    expect(t).toContain('NEW');
    // Still one action: the notes are not pressable.
    const pressables = r.root.findAll((n) => n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function');
    expect(pressables).toHaveLength(1);
  });

  it('shows only what is newer than the version already running, newest first', async () => {
    (globalThis as { __installedTop?: string }).__installedTop = 'r2';
    mockCheck.mockResolvedValue({
      isAvailable: true,
      manifest: manifestWith([rel('r4', 'Fourth', [['Four', 'd4']]), rel('r3', 'Third', [['Three', 'd3']]), rel('r2', 'Second', [['Two', 'd2']])]),
    });
    mockFetch.mockResolvedValue({ isNew: true });
    const t = text(await mount().then((r) => r.root));
    expect(t).toContain('Fourth');
    expect(t).toContain('Third');
    expect(t).not.toContain('Second');
    expect(t.indexOf('Fourth')).toBeLessThan(t.indexOf('Third'));
    expect(t).toContain('2 changes');
  });

  it('shows every release when the running build carries no notes', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true, manifest: manifestWith([rel('r2', 'Second', [['Two', 'd2']]), rel('r1', 'First', [['One', 'd1']])]) });
    mockFetch.mockResolvedValue({ isNew: true });
    const t = text(await mount().then((r) => r.root));
    expect(t).toContain('Second');
    expect(t).toContain('First');
  });

  it('says plainly that an update has no written notes instead of implying detail', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true, manifest: { extra: {} } });
    mockFetch.mockResolvedValue({ isNew: true });
    const t = text(await mount().then((r) => r.root));
    expect(t).toContain('This update has no written notes.');
    expect(t).toContain('Update now');
  });

  it('ignores a malformed entry rather than failing the update', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true, manifest: manifestWith([{ id: 'x' }, { id: 'y', title: 'Ok', items: [{ title: 'Good', body: 'Fine' }, { title: 'No body' }] }]) });
    mockFetch.mockResolvedValue({ isNew: true });
    const t = text(await mount().then((r) => r.root));
    expect(t).toContain('Good');
    expect(t).not.toContain('No body');
    expect(t).toContain('1 change to read');
  });
});
