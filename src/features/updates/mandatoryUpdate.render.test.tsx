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
  });
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

  it('lists what is new from the update manifest above the button', async () => {
    const manifest = {
      extra: { expoClient: { extra: { releaseNotes: { releases: [{ id: 'r1', date: '2026-10-25', title: 'Compact Glass', items: [{ title: 'Tighter screens', body: 'Home fits more on one screen.', icon: 'phone-portrait-outline' }] }] } } } },
    };
    mockCheck.mockResolvedValue({ isAvailable: true, manifest });
    mockFetch.mockResolvedValue({ isNew: true });
    const r = await mount();
    const t = text(r.root);
    expect(t).toContain('1 change');
    expect(t).toContain('Compact Glass');
    expect(t).toContain('Tighter screens');
    expect(t).toContain('Home fits more on one screen.');
    expect(t).toContain('Update now');
  });

  it('shows the glowing arrow-into-tray icon while updating, and no stars or sparkles', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockResolvedValue({ isNew: true });
    const r = await mount();
    expect(r.root.findAll((n) => n.props?.testID === 'update-glyph')).not.toHaveLength(0);
    // The old header icons are gone.
    const names = r.root.findAll((n) => typeof n.props?.name === 'string').map((n) => n.props.name as string);
    expect(names.filter((x) => /sparkle|star|cloud/.test(x))).toEqual([]);
  });

  it('keeps the plain error icon, not the glowing one, when the update failed', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockRejectedValue(new Error('Network request failed.'));
    const r = await mount();
    expect(text(r.root)).toContain('Update did not finish');
    expect(r.root.findAll((n) => n.props?.testID === 'update-glyph')).toHaveLength(0);
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
