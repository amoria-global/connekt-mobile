import { portfolioImages, profileFacts } from './profileFacts';

describe('profileFacts', () => {
  it('no rating is null, never 5.0', () => {
    expect(profileFacts({}).rating).toBeNull();
    expect(profileFacts({ rating: 0 }).rating).toBeNull();
    expect(profileFacts({ rating: Number.NaN }).rating).toBeNull();
  });
  it('a real rating is one decimal', () => {
    expect(profileFacts({ rating: 4.86 }).rating).toBe('4.9');
  });
  it('shoots appear only when there are some, and reviews are never negative', () => {
    expect(profileFacts({ completedJobs: 0 }).shoots).toBeNull();
    expect(profileFacts({ completedJobs: 58 }).shoots).toBe(58);
    expect(profileFacts({ reviewCount: -3 }).reviews).toBe(0);
  });
  it('booked only when the API says booked', () => {
    expect(profileFacts({}).booked).toBe(false);
    expect(profileFacts({ currentStatus: 'available' }).booked).toBe(false);
    expect(profileFacts({ currentStatus: 'BOOKED' }).booked).toBe(true);
  });
});

describe('portfolioImages', () => {
  it('drops the profile picture and repeats, keeps order', () => {
    expect(portfolioImages({ avatar: 'me.jpg', images: ['a.jpg', 'me.jpg', 'b.jpg', 'a.jpg', ''] })).toEqual(['a.jpg', 'b.jpg']);
  });
  it('no images is an empty list', () => {
    expect(portfolioImages({})).toEqual([]);
  });
});
