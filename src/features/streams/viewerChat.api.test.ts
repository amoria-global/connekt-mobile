import { sendViewerStreamChat } from './api';

const mockPost = jest.fn();
jest.mock('@/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn() }, requireOk: (r: unknown) => r }));

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ action: 1 });
});

describe('a signed-in viewer posting to the live chat', () => {
  it('posts the message in the body to the customer chat route, with the account token (not skipAuth)', async () => {
    await sendViewerStreamChat('event-1', 'hello');
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, opts] = mockPost.mock.calls[0];
    expect(url).toBe('/customer/events/event-1/chats');
    expect(url).not.toContain('coordinator');
    expect(body).toEqual({ message: 'hello' });
    expect(opts).toBeUndefined();
  });

  it('encodes the event id in the path', async () => {
    await sendViewerStreamChat('a/b', 'x');
    expect(mockPost.mock.calls[0][0]).toBe('/customer/events/a%2Fb/chats');
  });

  it('throws the server message when the envelope says it failed, so the screen can show it', async () => {
    mockPost.mockResolvedValue({ action: 0, message: 'Payment required to send chat messages' });
    await expect(sendViewerStreamChat('event-1', 'hi')).rejects.toMatchObject({ message: 'Payment required to send chat messages' });
  });

  it('falls back to a plain message when the server gives none', async () => {
    mockPost.mockResolvedValue({ action: 0 });
    await expect(sendViewerStreamChat('event-1', 'hi')).rejects.toMatchObject({ message: 'Could not send message.' });
  });
});
