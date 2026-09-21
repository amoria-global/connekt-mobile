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
});
