import { useUpdatesStore, getUpdates, isUpdateBlocking } from './useAppUpdates';

describe('useUpdatesStore and OTA Update logic', () => {
  beforeEach(() => {
    // Reset store to known state
    useUpdatesStore.setState({
      status: 'idle',
      isChecking: false,
      isDownloading: false,
      isUpdateAvailable: false,
      updateReady: false,
      downloadProgress: 0,
      lastCheckedTime: null,
      errorMessage: null,
      currentVersion: '2.2.0',
      updateId: null,
      channel: null,
      isEmbeddedLaunch: true,
    });
  });

  it('initializes with default version and idle state', () => {
    const state = useUpdatesStore.getState();
    expect(state.currentVersion).toBe('2.2.0');
    expect(state.updateReady).toBe(false);
    expect(state.isChecking).toBe(false);
    expect(state.isDownloading).toBe(false);
    expect(state.status).toBe('idle');
  });

  it('updates state when checking for updates', () => {
    useUpdatesStore.getState().setChecking(true);
    expect(useUpdatesStore.getState().isChecking).toBe(true);
    expect(useUpdatesStore.getState().status).toBe('checking');

    useUpdatesStore.getState().setChecking(false);
    expect(useUpdatesStore.getState().isChecking).toBe(false);
    expect(useUpdatesStore.getState().status).toBe('idle');
  });

  it('updates state and progress when downloading an update', () => {
    useUpdatesStore.getState().setDownloading(true, 0.65);
    const downloadingState = useUpdatesStore.getState();
    expect(downloadingState.isDownloading).toBe(true);
    expect(downloadingState.downloadProgress).toBe(0.65);
    expect(downloadingState.status).toBe('downloading');

    useUpdatesStore.getState().setDownloading(false);
    expect(useUpdatesStore.getState().isDownloading).toBe(false);
  });

  it('marks update as ready and transitions status to ready', () => {
    useUpdatesStore.getState().setUpdateReady(true);
    const readyState = useUpdatesStore.getState();
    expect(readyState.updateReady).toBe(true);
    expect(readyState.status).toBe('ready');
  });

  it('has no way to dismiss or postpone an update', () => {
    const state = useUpdatesStore.getState() as unknown as Record<string, unknown>;
    expect(state.dismissedInSession).toBeUndefined();
    expect(state.setDismissedInSession).toBeUndefined();
    expect(state.setModalVisible).toBeUndefined();
  });

  it('tracks last checked time and error messages', () => {
    const testDate = new Date('2026-09-24T12:00:00Z');
    useUpdatesStore.getState().setLastCheckedTime(testDate);
    expect(useUpdatesStore.getState().lastCheckedTime).toEqual(testDate);

    useUpdatesStore.getState().setErrorMessage('Network connection lost');
    expect(useUpdatesStore.getState().errorMessage).toBe('Network connection lost');
    expect(useUpdatesStore.getState().status).toBe('error');
  });

  it('safely handles getUpdates in non-production/test environment', () => {
    const updates = getUpdates();
    // In test environment, getUpdates should not throw
    expect(updates !== undefined).toBe(true);
  });
});

describe('isUpdateBlocking', () => {
  const base = { updateReady: false, isDownloading: false, isUpdateAvailable: false, isChecking: false, errorMessage: null };

  it('does not block when there is no known update, even after a failed check', () => {
    expect(isUpdateBlocking(base)).toBe(false);
    expect(isUpdateBlocking({ ...base, errorMessage: 'offline' })).toBe(false);
    expect(isUpdateBlocking({ ...base, isChecking: true })).toBe(false);
  });

  it('blocks while downloading, once downloaded, and after a failed download', () => {
    expect(isUpdateBlocking({ ...base, isDownloading: true })).toBe(true);
    expect(isUpdateBlocking({ ...base, updateReady: true })).toBe(true);
    expect(isUpdateBlocking({ ...base, isUpdateAvailable: true, errorMessage: 'timeout' })).toBe(true);
  });

  it('keeps blocking while a failed download is retried', () => {
    expect(isUpdateBlocking({ ...base, isUpdateAvailable: true, isChecking: true })).toBe(true);
  });
});
