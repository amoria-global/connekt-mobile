import { sendEventVideoWish, sendEventWish, wishErrorMessage } from './api';

const mockPost = jest.fn();
jest.mock('@/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn() }, requireOk: (r: unknown) => r }));
jest.mock('@/utils/deviceId', () => ({ getDeviceId: async () => 'device-1' }));
const mockAppend = jest.fn();
jest.mock('@/utils/upload', () => ({ appendFile: async (...a: unknown[]) => mockAppend(...a) }));

class FakeForm {
  parts: [string, unknown][] = [];
  append(k: string, v: unknown) {
    this.parts.push([k, v]);
  }
}
(globalThis as { FormData?: unknown }).FormData = FakeForm;

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ action: 1 });
  mockAppend.mockReset();
});

describe('text wish', () => {
  it('sends the device fingerprint the backend requires (without it every wish was refused)', async () => {
    await sendEventWish('e1', { name: 'Aline', email: 'a@b.co', message: 'Hi' });
    expect(mockPost).toHaveBeenCalledWith('/public/events/e1/wishes', { name: 'Aline', email: 'a@b.co', message: 'Hi', visibility: 'private', deviceFingerprint: 'device-1' }, { skipAuth: true });
  });

  it('sends the chosen visibility', async () => {
    await sendEventWish('e1', { name: 'Aline', email: 'a@b.co', message: 'Hi', visibility: 'public' });
    expect(mockPost.mock.calls[0][1]).toMatchObject({ visibility: 'public' });
  });

  it('turns a refusal into the web wording', async () => {
    mockPost.mockResolvedValue({ action: 0, message: 'Wishes are closed for this event' });
    await expect(sendEventWish('e1', { name: 'A', email: 'a@b.co', message: 'Hi' })).rejects.toMatchObject({ message: 'Wishes are closed for this event.' });
  });
});

describe('video wish', () => {
  const video = { uri: 'file:///w.mp4', name: 'w.mp4', mimeType: 'video/mp4' };

  it('posts the clip as multipart to the wishes/video endpoint with name, email, fingerprint and caption', async () => {
    await sendEventVideoWish('e1', { name: 'Aline', email: 'a@b.co', message: ' Best wishes ', video });
    const [path, form, opts] = mockPost.mock.calls[0];
    expect(path).toBe('/public/events/e1/wishes/video');
    expect(opts).toEqual({ skipAuth: true });
    expect(Object.fromEntries((form as FakeForm).parts)).toEqual({ name: 'Aline', email: 'a@b.co', deviceFingerprint: 'device-1', visibility: 'private', message: 'Best wishes' });
    expect(mockAppend).toHaveBeenCalledWith(expect.anything(), 'video', { uri: 'file:///w.mp4', name: 'w.mp4', type: 'video/mp4' });
  });

  it('sends visibility and the clip length rounded up to whole seconds', async () => {
    await sendEventVideoWish('e1', { name: 'Aline', email: 'a@b.co', visibility: 'public', durationSeconds: 41.2, video });
    expect(Object.fromEntries((mockPost.mock.calls[0][1] as FakeForm).parts)).toMatchObject({ visibility: 'public', duration: '42' });
  });

  it('leaves the caption out when there is none', async () => {
    await sendEventVideoWish('e1', { name: 'Aline', email: 'a@b.co', message: '  ', video });
    expect((mockPost.mock.calls[0][1] as FakeForm).parts.map(([k]) => k)).not.toContain('message');
  });

  it('is an error, never a success, when the backend refuses', async () => {
    mockPost.mockResolvedValue({ action: 0, message: 'File must be a video' });
    await expect(sendEventVideoWish('e1', { name: 'A', email: 'a@b.co', video })).rejects.toMatchObject({ message: 'File must be a video' });
  });
});

describe('wish error wording', () => {
  it('matches the web page case by case', () => {
    expect(wishErrorMessage('rate limit exceeded', 'text')).toContain('too quickly');
    expect(wishErrorMessage('Message contains restricted content', 'text')).toContain('restricted content');
    expect(wishErrorMessage('file too large', 'video')).toContain('shorter clip');
    expect(wishErrorMessage('file too large', 'text')).toBe('file too large');
    expect(wishErrorMessage(undefined, 'video')).toContain('video wish');
  });
});
