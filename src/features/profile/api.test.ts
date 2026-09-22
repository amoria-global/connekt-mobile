import { normalizeMediaUrl } from './api';

describe('normalizeMediaUrl', () => {
  it('rejects empty and /null paths', () => {
    expect(normalizeMediaUrl(undefined)).toBeUndefined();
    expect(normalizeMediaUrl('')).toBeUndefined();
    expect(normalizeMediaUrl('null')).toBeUndefined();
    expect(
      normalizeMediaUrl('https://backend.connekyt.com/uploads/photographer/cover/images/null'),
    ).toBeUndefined();
  });

  it('keeps absolute https URLs', () => {
    const url =
      'https://backend.connekyt.com/uploads/photographer/cover/images/1779184658541d4706309ec8db83f73bc5651bad2d4.jpg';
    expect(normalizeMediaUrl(url)).toBe(url);
  });

  it('anchors relative upload paths to the API host', () => {
    expect(normalizeMediaUrl('/uploads/photographer/cover/images/x.jpg')).toBe(
      'https://backend.connekyt.com/uploads/photographer/cover/images/x.jpg',
    );
  });
});
