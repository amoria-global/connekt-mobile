/**
 * Copy works on every installed build: straight to the clipboard where the native module exists, the share sheet
 * (which has Copy) where it does not, and never a crash on a build without it.
 */
const mockSet = jest.fn();
let mockNative: { setStringAsync?: unknown } | null = null;
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
const mockShare = jest.fn();
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Share: { share: (...a: unknown[]) => mockShare(...a), dismissedAction: 'dismissedAction', sharedAction: 'sharedAction' },
}));

function load(native: typeof mockNative) {
  jest.resetModules();
  mockNative = native;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./copyText') as typeof import('./copyText');
}

beforeEach(() => {
  mockSet.mockReset();
  mockShare.mockReset();
});

describe('on a build with the clipboard module', () => {
  it('copies straight to the clipboard, marking a sensitive value on Android', async () => {
    mockSet.mockResolvedValue(true);
    const { copyText, canCopyDirectly } = load({ setStringAsync: mockSet });
    expect(canCopyDirectly()).toBe(true);
    await expect(copyText('ABCD EFGH', { sensitive: true })).resolves.toBe('copied');
    expect(mockSet).toHaveBeenCalledWith('ABCD EFGH', { isSensitive: true });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('adds no sensitive flag unless asked', async () => {
    mockSet.mockResolvedValue(true);
    const { copyText } = load({ setStringAsync: mockSet });
    await copyText('x');
    expect(mockSet).toHaveBeenCalledWith('x', {});
  });

  it('falls back to the share sheet when the native call fails', async () => {
    mockSet.mockRejectedValue(new Error('boom'));
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    const { copyText } = load({ setStringAsync: mockSet });
    await expect(copyText('x')).resolves.toBe('shared');
  });
});

describe('on a build without the clipboard module', () => {
  it('does not crash on import and opens the share sheet', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    const { copyText, canCopyDirectly } = load(null);
    expect(canCopyDirectly()).toBe(false);
    await expect(copyText('ABCD')).resolves.toBe('shared');
    expect(mockShare).toHaveBeenCalledWith({ message: 'ABCD' });
  });

  it('reports a dismissed sheet as cancelled, not as a failure', async () => {
    mockShare.mockResolvedValue({ action: 'dismissedAction' });
    const { copyText } = load(null);
    await expect(copyText('x')).resolves.toBe('cancelled');
  });

  it('reports a sheet that cannot open as failed', async () => {
    mockShare.mockRejectedValue(new Error('no'));
    const { copyText } = load(null);
    await expect(copyText('x')).resolves.toBe('failed');
  });
});
