import { appendFile, fileToBlob } from './upload';

describe('upload utils', () => {
  it('converts data: URIs to Blob', async () => {
    // 1x1 transparent PNG / simple base64
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = await fileToBlob({ uri: dataUri, type: 'image/png' });
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('image/png');
  });

  it('appends mock blob to FormData in test environment', async () => {
    const form = new FormData();
    await appendFile(form, 'testFile', {
      uri: 'file:///mock/image.jpg',
      name: 'image.jpg',
      type: 'image/jpeg',
    });

    expect(form).toBeInstanceOf(FormData);
  });

  it('throws error when photo URI is empty and unreadable', async () => {
    const form = new FormData();
    await expect(
      appendFile(form, 'testFile', {
        uri: '',
        name: 'empty.jpg',
      }),
    ).rejects.toEqual({
      status: 0,
      message: 'Could not read that photo. Please pick it again.',
    });
  });

  it('names a video, not a photo, when a clip cannot be read', async () => {
    const form = new FormData();
    await expect(
      appendFile(form, 'video', { uri: '', name: 'wish.mp4', type: 'video/mp4' }),
    ).rejects.toEqual({
      status: 0,
      message: 'Could not read that video. Please record it again.',
    });
  });

  it('hands a video to the form as the file itself, never copied into memory', async () => {
    class FakeFile {
      exists = true;
      size = 5_000_000;
      constructor(public uri: string) {}
    }
    let fresh!: typeof appendFile;
    jest.isolateModules(() => {
      jest.doMock('expo-file-system', () => ({ File: FakeFile }));
      fresh = require('./upload').appendFile;
    });
    const parts: [string, unknown, string][] = [];
    const form = { append: (k: string, v: unknown, n: string) => parts.push([k, v, n]) } as unknown as FormData;
    await fresh(form, 'video', { uri: 'file:///cache/clip.mp4', name: 'clip.mp4', type: 'video/mp4' });
    expect(parts).toHaveLength(1);
    expect(parts[0][1]).toBeInstanceOf(FakeFile);
    expect(parts[0][2]).toBe('clip.mp4');
  });
});
