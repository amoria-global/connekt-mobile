import { useUpdatesStore, getUpdates } from './useAppUpdates';

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
      isModalVisible: false,
      dismissedInSession: false,
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

  it('controls modal visibility and tracks user session dismissal', () => {
    useUpdatesStore.getState().setModalVisible(true);
    expect(useUpdatesStore.getState().isModalVisible).toBe(true);

    useUpdatesStore.getState().setModalVisible(false);
    useUpdatesStore.getState().setDismissedInSession(true);
    expect(useUpdatesStore.getState().isModalVisible).toBe(false);
    expect(useUpdatesStore.getState().dismissedInSession).toBe(true);
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
