import { clearReminder, getReminder, isValidReminderEmail, setReminder } from './reminder';

/**
 * "Get notified" talks to the backend through the shared api client. Signed in it uses the
 * customer route with the member's token; a guest uses the public route with an email and
 * no token. A refusal arrives as HTTP 200 with action 0 and must surface, never read as a yes.
 */
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
  requireOk: (res: { action?: number; message?: string }) => {
    if (res && 'action' in res && res.action !== 1) throw { status: 200, message: res.message || 'Could not load this.' };
    return res;
  },
}));

const ID = '11111111-1111-1111-1111-111111111111';
const ok = { action: 1, message: 'OK', data: { subscribed: true } };

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue(ok);
  mockPost.mockReset().mockResolvedValue(ok);
  mockDelete.mockReset().mockResolvedValue({ action: 1, data: { subscribed: false } });
});

describe('event reminder client', () => {
  it('signed in: customer route, member token, no email', async () => {
    await setReminder(ID, { signedIn: true });
    expect(mockPost).toHaveBeenCalledWith(`/api/remote/customer/events/${ID}/reminder`, undefined, { skipAuth: false });
    await clearReminder(ID, { signedIn: true });
    expect(mockDelete).toHaveBeenCalledWith(`/api/remote/customer/events/${ID}/reminder`, { skipAuth: false });
    expect(await getReminder(ID, { signedIn: true })).toBe(true);
    expect(mockGet).toHaveBeenCalledWith(`/api/remote/customer/events/${ID}/reminder`, { skipAuth: false });
  });

  it('guest: public route, email lower-cased, no token', async () => {
    await setReminder(ID, { signedIn: false, email: '  Jo@Example.COM ' });
    expect(mockPost).toHaveBeenCalledWith(`/api/remote/public/events/${ID}/reminder`, { email: 'jo@example.com' }, { skipAuth: true });
    await clearReminder(ID, { signedIn: false, email: 'a+b@x.co' });
    expect(mockDelete).toHaveBeenCalledWith(`/api/remote/public/events/${ID}/reminder?email=a%2Bb%40x.co`, { skipAuth: true });
  });

  it('a guest with no or a bad email is refused before any request', async () => {
    await expect(setReminder(ID, { signedIn: false, email: 'nope' })).rejects.toMatchObject({ message: 'Enter a valid email address.' });
    expect(mockPost).not.toHaveBeenCalled();
    expect(await getReminder(ID, { signedIn: false })).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('an HTTP 200 with action 0 surfaces the server message', async () => {
    mockPost.mockResolvedValue({ action: 0, message: 'This event has already ended or was cancelled.' });
    await expect(setReminder(ID, { signedIn: true })).rejects.toMatchObject({
      message: 'This event has already ended or was cancelled.',
    });
  });

  it('validates emails', () => {
    expect(isValidReminderEmail('a@b.co')).toBe(true);
    expect(isValidReminderEmail('a@b')).toBe(false);
    expect(isValidReminderEmail('')).toBe(false);
  });
});
