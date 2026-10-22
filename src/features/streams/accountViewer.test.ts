import { registerAccountViewer } from './accountViewer';

const mockRegister = jest.fn();
const mockSet = jest.fn();
jest.mock('@/features/streams/api', () => ({ registerAnonymousViewer: (...a: unknown[]) => mockRegister(...a) }));
jest.mock('@/utils/deviceId', () => ({ getDeviceId: async () => 'device-1' }));
jest.mock('@/services/storage', () => ({ storage: { set: (...a: unknown[]) => mockSet(...a) } }));

const account = { name: 'Joseph Maranatha', email: 'joseph@example.test' };

beforeEach(() => {
  mockRegister.mockReset();
  mockSet.mockReset().mockResolvedValue(undefined);
});

describe('a signed-in account joining a free live stream', () => {
  it('is registered as a viewer from its own name and email, with no form, and remembered for the event', async () => {
    mockRegister.mockResolvedValue({ viewerId: 'v1' });
    await expect(registerAccountViewer('e1', account, { paid: false })).resolves.toBe('v1');
    expect(mockRegister).toHaveBeenCalledWith('e1', { name: 'Joseph Maranatha', email: 'joseph@example.test', phone: '0000000000', deviceId: 'device-1' });
    expect(mockSet).toHaveBeenCalledWith('anonymousViewer_e1', 'v1');
  });

  it('is not registered silently on a paid event, where access is matched to a purchase', async () => {
    await expect(registerAccountViewer('e1', account, { paid: true })).resolves.toBeUndefined();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('has nothing to register without an account name and email, so the form is shown', async () => {
    await expect(registerAccountViewer('e1', null, { paid: false })).resolves.toBeUndefined();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('falls back to the form when registering fails or returns no viewer', async () => {
    mockRegister.mockRejectedValueOnce({ message: 'offline' }).mockResolvedValueOnce({});
    await expect(registerAccountViewer('e1', account, { paid: false })).resolves.toBeUndefined();
    await expect(registerAccountViewer('e1', account, { paid: false })).resolves.toBeUndefined();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
